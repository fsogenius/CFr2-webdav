// 文件名：src/types.ts
export interface Env {
  BUCKET: R2Bucket;
  USERNAME: string;
  PASSWORD: string;
  BUCKET_NAME: string;
}

export interface CacheableResponse {
  response: Response;
  expiry: number;
}

export interface WebDAVProps {
  href: string;
  creationdate: string;
  displayname: string;
  getcontentlanguage: string | undefined;
  getcontentlength: string;
  getcontenttype: string | undefined;
  getetag: string | undefined;
  getlastmodified: string;
  resourcetype: string;
}