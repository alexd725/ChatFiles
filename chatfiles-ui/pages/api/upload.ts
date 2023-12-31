import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import fetch from 'node-fetch';
// import FormData from 'form-data';
import { IncomingForm } from 'formidable';
import { CHAT_FILES_SERVER_HOST } from '@/utils/app/const';
import { LlamaIndex } from '@/types';
import { File } from 'fetch-blob/file.js';
import { fileFromSync } from 'fetch-blob/from.js';
import { FormData } from 'formdata-polyfill/esm.min.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const fData = await new Promise<{ fields: any; files: any }>(
      (resolve, reject) => {
        const form = new IncomingForm({ multiples: true });
        form.parse(req, async (err, fields, files) => {
          if (err) {
            console.error('Incoming form error:', err);
            reject(err);
          } else {
            resolve({ fields, files });
          }
        });
      },
    );

    if (fData?.files.file) {
      const uploadFiles = Array.isArray(fData.files.file)
        ? fData.files.file
        : [fData.files.file];

      const formData = new FormData();

      uploadFiles.forEach(
        (
          uploadFile: { filepath: string; originalFilename: string },
          index: number,
        ) => {
          const file = fileFromSync(uploadFile.filepath); // Use fileFromSync to read file
          formData.append(
            `file${index}`,
            new File([file], uploadFile.originalFilename), // Use File constructor from fetch-blob/file.js
          );
        },
      );

      const response = await fetch(`${CHAT_FILES_SERVER_HOST}/upload`, {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();

      res.status(200).json(json);
    } else {
      console.error('No files found in request');
      res.status(400).json({ error: 'No files found in request' });
    }
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;
