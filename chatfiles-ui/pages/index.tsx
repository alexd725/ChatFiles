import { Chat } from '@/components/Chat/Chat';
import { Navbar } from '@/components/Mobile/Navbar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import {
  ChatBody,
  ChatFolder,
  Conversation,
  ErrorMessage,
  Message,
  OpenAIModel,
  OpenAIModelID,
  OpenAIModels,
} from '@/types';
import {
  cleanConversationHistory,
  cleanSelectedConversation,
} from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';
import {
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
import { exportData, importData } from '@/utils/app/importExport';
import { IconArrowBarRight } from '@tabler/icons-react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useEffect, useRef, useState, useCallback } from 'react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import useConversations from '@/hooks/useConversation';

interface HomeProps {
  serverSideApiKeyIsSet: boolean;
}

const Home: React.FC<HomeProps> = ({ serverSideApiKeyIsSet }) => {
  const {
    conversations,
    setConversations,
    selectedConversation,
    setSelectedConversation,
    handleDeleteConversation,
    handleUpdateConversation,
  } = useConversations();

  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const [lightMode, setLightMode] = useState<'dark' | 'light'>('dark');
  const [messageIsStreaming, setMessageIsStreaming] = useState<boolean>(false);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [messageError, setMessageError] = useState<boolean>(false);
  const [modelError, setModelError] = useState<ErrorMessage | null>(null);
  const [currentMessage, setCurrentMessage] = useState<Message>();
  const stopConversationRef = useRef<boolean>(false);
  const fetchChat = async (chatBody: ChatBody) => {
    const controller = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(chatBody),
    });
    if (!response.ok) throw Error('Chat fetch failed');
    if (!response.body) throw Error('Chat fetch failed: response body is null');
    return response.body.getReader();
  };

  const fetchQuery = async (
    message: Message,
    index: { indexName: string; indexType: string },
  ): Promise<any> => {
    const response = await fetch(
      `/api/query?message=${message.content}&indexName=${index.indexName}&indexType=${index.indexType}`,
      {
        method: 'GET',
      },
    );
    const answer = await response.json();
    return answer;
  };

  const updateConversationMessages = (
    conversation: Conversation,
    message: Message,
  ) => {
    return {
      ...conversation,
      messages: [...conversation.messages, message],
    };
  };

  const handleErrorState = () => {
    setLoading(false);
    setMessageIsStreaming(false);
    setMessageError(true);
  };

  const handleSend = useCallback(
    async (message: Message, deleteCount = 0) => {
      if (!selectedConversation) return;

      let updatedConversation = selectedConversation;

      if (deleteCount) {
        updatedConversation.messages.splice(-deleteCount);
      }
      updatedConversation = updateConversationMessages(
        updatedConversation,
        message,
      );

      setSelectedConversation(updatedConversation);
      setLoading(true);
      setMessageIsStreaming(true);
      setMessageError(false);

      try {
        if (updatedConversation?.index?.indexName?.length === 0) {
          const chatBody: ChatBody = {
            model: updatedConversation.model,
            messages: updatedConversation.messages,
            key: apiKey,
            prompt: updatedConversation.prompt,
          };
          const reader = await fetchChat(chatBody);
        } else {
          const answer = await fetchQuery(message, updatedConversation.index);
          const newMessage = { role: 'assistant', content: answer };
          updatedConversation = updateConversationMessages(
            updatedConversation,
            newMessage as Message,
          );
        }

        setLoading(false);
        setSelectedConversation(updatedConversation);
        saveConversation(updatedConversation);
        const updatedConversations: Conversation[] = conversations.map(
          (conversation) => {
            if (conversation.id === selectedConversation.id) {
              return updatedConversation;
            }

            return conversation;
          },
        );

        setConversations(updatedConversations);
        saveConversations(updatedConversations);
        setMessageIsStreaming(false);
      } catch (error) {
        handleErrorState();
      }
    },
    [
      conversations,
      selectedConversation,
      apiKey,
      setConversations,
      setSelectedConversation,
    ],
  );

  const fetchModels = useCallback(async (key: string) => {
    const error = {
      title: 'Error fetching models',
      code: null,
      messageLines: [
        'Make sure your OpenAI API key is set in the bottom left of the sidebar.',
        'If you completed this step, OpenAI may be experiencing issues.',
      ],
    } as ErrorMessage;

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        Object.assign(error, {
          code: data.error?.code,
          messageLines: [data.error?.message],
        });
        setModelError(error);
        return;
      }

      const data = await response.json();

      if (!data) {
        setModelError(error);
        return;
      }

      setModels(data);
      setModelError(null);
    } catch (e) {
      setModelError(error);
    }
  }, []);

  const handleLightMode = (mode: 'dark' | 'light') => {
    setLightMode(mode);
    localStorage.setItem('theme', mode);
  };

  const handleApiKeyChange = (apiKey: string) => {
    setApiKey(apiKey);
    localStorage.setItem('apiKey', apiKey);
  };

  const handleExportData = () => {
    exportData();
  };

  const handleImportConversations = (data: {
    conversations: Conversation[];
    folders: ChatFolder[];
  }) => {
    importData(data.conversations, data.folders);
    setConversations(data.conversations);
    setSelectedConversation(data.conversations[data.conversations.length - 1]);
    setFolders(data.folders);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    saveConversation(conversation);
  };

  const handleCreateFolder = (name: string) => {
    const lastFolder = folders[folders.length - 1];

    const newFolder: ChatFolder = {
      id: lastFolder ? lastFolder.id + 1 : 1,
      name,
    };

    const updatedFolders = [...folders, newFolder];

    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  const handleDeleteFolder = (folderId: number) => {
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    setFolders(updatedFolders);
    saveFolders(updatedFolders);

    const updatedConversations: Conversation[] = conversations.map((c) => {
      if (c.folderId === folderId) {
        return {
          ...c,
          folderId: 0,
        };
      }

      return c;
    });
    setConversations(updatedConversations);
    saveConversations(updatedConversations);
  };

  const handleUpdateFolder = (folderId: number, name: string) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        return {
          ...f,
          name,
        };
      }

      return f;
    });

    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  const handleNewConversation = () => {
    const lastConversation = conversations[conversations.length - 1];

    const newConversation: Conversation = {
      id: lastConversation ? lastConversation.id + 1 : 1,
      name: `${'Conversation'} ${
        lastConversation ? lastConversation.id + 1 : 1
      }`,
      messages: [],
      model: OpenAIModels[OpenAIModelID.GPT_3_5],
      prompt: DEFAULT_SYSTEM_PROMPT,
      folderId: 0,
      fileNames: [],
      index: {
        indexName: '',
        indexType: '',
        fileNames: [],
      },
    };

    const updatedConversations = [...conversations, newConversation];

    setSelectedConversation(newConversation);
    setConversations(updatedConversations);

    saveConversation(newConversation);
    saveConversations(updatedConversations);

    setLoading(false);
  };

  const handleClearConversations = () => {
    setConversations([]);
    localStorage.removeItem('conversationHistory');

    setSelectedConversation({
      id: 1,
      name: 'New conversation',
      messages: [],
      model: OpenAIModels[OpenAIModelID.GPT_3_5],
      prompt: DEFAULT_SYSTEM_PROMPT,
      folderId: 0,
      fileNames: [],
      index: {
        indexName: '',
        indexType: '',
        fileNames: [],
      },
    });
    localStorage.removeItem('selectedConversation');

    setFolders([]);
    localStorage.removeItem('folders');
  };

  const handleEditMessage = (message: Message, messageIndex: number) => {
    if (selectedConversation) {
      const updatedMessages = selectedConversation.messages
        .map((m, i) => {
          if (i < messageIndex) {
            return m;
          }
        })
        .filter((m) => m) as Message[];

      const updatedConversation = {
        ...selectedConversation,
        messages: updatedMessages,
      };

      const { single, all } = updateConversation(
        updatedConversation,
        conversations,
      );

      setSelectedConversation(single);
      setConversations(all);

      setCurrentMessage(message);
    }
  };

  useEffect(() => {
    if (currentMessage) {
      handleSend(currentMessage);
      setCurrentMessage(undefined);
    }
  }, [currentMessage, handleSend]);

  useEffect(() => {
    if (window.innerWidth < 640) {
      setShowSidebar(false);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (apiKey) {
      fetchModels(apiKey);
    }
  }, [apiKey, fetchModels]);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme) {
      setLightMode(theme as 'dark' | 'light');
    }

    const apiKey = localStorage.getItem('apiKey');
    if (apiKey) {
      setApiKey(apiKey);
      fetchModels(apiKey);
    } else if (serverSideApiKeyIsSet) {
      fetchModels('');
    }

    if (window.innerWidth < 640) {
      setShowSidebar(false);
    }

    const folders = localStorage.getItem('folders');
    if (folders) {
      setFolders(JSON.parse(folders));
    }

    const conversationHistory = localStorage.getItem('conversationHistory');
    if (conversationHistory) {
      const parsedConversationHistory: Conversation[] =
        JSON.parse(conversationHistory);
      const cleanedConversationHistory = cleanConversationHistory(
        parsedConversationHistory,
      );
      setConversations(cleanedConversationHistory);
    }

    const selectedConversation = localStorage.getItem('selectedConversation');
    if (selectedConversation) {
      const parsedSelectedConversation: Conversation =
        JSON.parse(selectedConversation);
      const cleanedSelectedConversation = cleanSelectedConversation(
        parsedSelectedConversation,
      );
      setSelectedConversation(cleanedSelectedConversation);
    } else {
      setSelectedConversation({
        id: 1,
        name: 'New conversation',
        messages: [],
        model: OpenAIModels[OpenAIModelID.GPT_3_5],
        prompt: DEFAULT_SYSTEM_PROMPT,
        folderId: 0,
        fileNames: [],
        index: {
          indexName: '',
          indexType: '',
          fileNames: [],
        },
      });
    }
  }, [
    serverSideApiKeyIsSet,
    fetchModels,
    setConversations,
    setSelectedConversation,
  ]);

  return (
    <>
      <Head>
        <title>ChatFiles</title>
        <meta name="description" content="ChatGPT but better." />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {selectedConversation && (
        <main
          className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
        >
          <div className="fixed top-0 w-full sm:hidden">
            <Navbar
              selectedConversation={selectedConversation}
              onNewConversation={handleNewConversation}
            />
          </div>

          <div className="flex h-full w-full pt-[48px] sm:pt-0">
            {showSidebar ? (
              <div>
                <Sidebar
                  loading={messageIsStreaming}
                  conversations={conversations}
                  lightMode={lightMode}
                  selectedConversation={selectedConversation}
                  apiKey={apiKey}
                  folders={folders}
                  onToggleLightMode={handleLightMode}
                  onCreateFolder={handleCreateFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onUpdateFolder={handleUpdateFolder}
                  onNewConversation={handleNewConversation}
                  onSelectConversation={handleSelectConversation}
                  onDeleteConversation={handleDeleteConversation}
                  onToggleSidebar={() => setShowSidebar(!showSidebar)}
                  onUpdateConversation={handleUpdateConversation}
                  onApiKeyChange={handleApiKeyChange}
                  onClearConversations={handleClearConversations}
                  onExportConversations={handleExportData}
                  onImportConversations={handleImportConversations}
                />

                <div
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="absolute top-0 left-0 z-10 h-full w-full bg-black opacity-70 sm:hidden"
                ></div>
              </div>
            ) : (
              <IconArrowBarRight
                className="fixed top-2.5 left-4 z-50 h-7 w-7 cursor-pointer text-white hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-0.5 sm:left-4 sm:h-8 sm:w-8 sm:text-neutral-700"
                onClick={() => setShowSidebar(!showSidebar)}
              />
            )}

            {conversations.length > 0 ? (
              <Chat
                conversation={selectedConversation}
                messageIsStreaming={messageIsStreaming}
                apiKey={apiKey}
                serverSideApiKeyIsSet={serverSideApiKeyIsSet}
                modelError={modelError}
                messageError={messageError}
                models={models}
                loading={loading}
                onSend={handleSend}
                onUpdateConversation={handleUpdateConversation}
                onEditMessage={handleEditMessage}
                stopConversationRef={stopConversationRef}
              />
            ) : (
              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-white p-4 text-center text-3xl font-bold leading-relaxed tracking-wide text-gray-800 dark:bg-[#343541] dark:text-gray-400 sm:p-10 sm:text-4xl">
                Get started by creating a new chat in the sidebar
              </div>
            )}
          </div>
        </main>
      )}
    </>
  );
};
export default Home;

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  return {
    props: {
      serverSideApiKeyIsSet: !!process.env.OPENAI_API_KEY,
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'markdown',
      ])),
    },
  };
};
