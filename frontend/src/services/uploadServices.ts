import axios from "axios";
import { api } from "./apiClient";

export interface UploadedMedia {
  mediaType: string;
  mediaURL: string;
  mediaName: string;
  mediaSize: number;
}

/**
 * Uploads files straight to Cloudinary using a short-lived signature issued by our API.
 * The API secret never reaches the browser, and the signature is scoped to our folder.
 * Throws on failure (callers show the message).
 */
export const uploadFiles = async (files: File[]): Promise<UploadedMedia[]> => {
  return Promise.all(
    files.map(async (file) => {
      const { data: sig } = await api.post("/uploads/sign");
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      const { data } = await axios.post(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, form);
      return { mediaType: file.type, mediaURL: data.secure_url, mediaName: file.name, mediaSize: file.size };
    })
  );
};
