import { Injectable } from '@angular/core';
import { CfgErrorJson, CfgJobStatus, CfgLanguage, CfgResultJson } from './cfg-import.types';

const API_BASE_URL = 'http://localhost:8000';

@Injectable({ providedIn: 'root' })
export class CfgImportApiService {
  async createJobFromSource(language: CfgLanguage, filename: string, source: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/cfg/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, filename, source }),
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new Error(`Failed to create job: ${response.status} ${detail}`);
    }

    const body = await response.json() as { jobId: string };
    return body.jobId;
  }

  async createJobFromUpload(language: CfgLanguage, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('language', language);
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/cfg/jobs/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new Error(`Failed to upload job: ${response.status} ${detail}`);
    }

    const body = await response.json() as { jobId: string };
    return body.jobId;
  }

  async getStatus(jobId: string): Promise<CfgJobStatus> {
    const response = await fetch(`${API_BASE_URL}/cfg/jobs/${jobId}`);
    if (response.status === 404) {
      throw new Error('Job not found.');
    }
    if (!response.ok) {
      throw new Error(`Failed to read status: ${response.status}`);
    }
    return response.json() as Promise<CfgJobStatus>;
  }

  async getResult(jobId: string): Promise<{ pending: true } | { pending: false; result: CfgResultJson | CfgErrorJson }> {
    const response = await fetch(`${API_BASE_URL}/cfg/jobs/${jobId}/result`);

    if (response.status === 202) {
      return { pending: true };
    }
    if (response.status === 404) {
      throw new Error('Job not found.');
    }
    if (!response.ok) {
      throw new Error(`Failed to read result: ${response.status}`);
    }

    const payload = await response.json() as CfgResultJson | CfgErrorJson;
    return { pending: false, result: payload };
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
