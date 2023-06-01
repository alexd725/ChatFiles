import { ChatFolder, Conversation } from '@/types';
import { IconFileExport, IconMoon, IconSun } from '@tabler/icons-react';
import { FC } from 'react';
import { ClearConversations } from './ClearConversations';
import { Import } from './Import';
import { Key } from './Key';
import { SidebarButton } from './SidebarButton';

interface Props {
  lightMode: 'light' | 'dark';
  apiKey: string;
  onToggleLightMode: (mode: 'light' | 'dark') => void;
  onApiKeyChange: (apiKey: string) => void;
  onClearConversations: () => void;
  onExportConversations: () => void;
  onImportConversations: (data: {
    conversations: Conversation[];
    folders: ChatFolder[];
  }) => void;
}

export const SidebarSettings: FC<Props> = ({
  lightMode,
  apiKey,
  onToggleLightMode,
  onApiKeyChange,
  onClearConversations,
  onExportConversations,
  onImportConversations,
}) => {
  return (
    <div className="flex flex-col items-center space-y-1 border-t border-white/20 pt-1 text-sm">
      <ClearConversations onClearConversations={onClearConversations} />

      <Import onImport={onImportConversations} />

      <SidebarButton
        text={'Export conversations'}
        icon={<IconFileExport size={18} />}
        onClick={() => onExportConversations()}
      />

      <SidebarButton
        text={lightMode === 'light' ? 'Dark mode' : 'Light mode'}
        icon={
          lightMode === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />
        }
        onClick={() =>
          onToggleLightMode(lightMode === 'light' ? 'dark' : 'light')
        }
      />

      <Key apiKey={apiKey} onApiKeyChange={onApiKeyChange} />
    </div>
  );
};
