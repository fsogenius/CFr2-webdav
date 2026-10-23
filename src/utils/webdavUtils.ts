// 文件名：src/utils/webdavUtils.ts
import { R2Object } from '@cloudflare/workers-types';
import { WebDAVProps } from '../types';

export function make_resource_path(request: Request): string {
  const url = new URL(request.url);
  return decodeURIComponent(url.pathname.slice(1));
}

export function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function pathToHref(path: string): string {
  return `/${encodePath(path)}`;
}

function getDisplayName(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/').pop() || '';
}

export function collectionProps(path: string): WebDAVProps {
  const now = new Date().toUTCString();
  return {
    href: pathToHref(path),
    creationdate: now,
    displayname: getDisplayName(path),
    getcontentlanguage: undefined,
    getcontentlength: '0',
    getcontenttype: undefined,
    getetag: undefined,
    getlastmodified: now,
    resourcetype: 'collection'
  };
}

export function objectProps(object: R2Object): WebDAVProps {
  return {
    href: pathToHref(object.key),
    creationdate: object.uploaded.toUTCString(),
    displayname: object.key.split('/').pop() || object.key,
    getcontentlanguage: object.httpMetadata?.contentLanguage,
    getcontentlength: object.size.toString(),
    getcontenttype: object.httpMetadata?.contentType,
    getetag: object.etag,
    getlastmodified: object.uploaded.toUTCString(),
    resourcetype: object.customMetadata?.resourcetype === 'collection' ? 'collection' : ''
  };
}

export type DavEntry =
  | { type: 'object'; object: R2Object }
  | { type: 'prefix'; prefix: string };

export async function* listEntries(bucket: R2Bucket, prefix: string): AsyncGenerator<DavEntry> {
  const options = { prefix, delimiter: '/' };
  let cursor: string | undefined;

  do {
    const result = await bucket.list({ ...options, cursor });

    for (const object of result.objects) {
      if (object.key === prefix) continue;
      yield { type: 'object', object };
    }

    for (const folder of result.delimitedPrefixes ?? []) {
      yield { type: 'prefix', prefix: folder };
    }

    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
}

export function entryProps(entry: DavEntry): WebDAVProps {
  return entry.type === 'object' ? objectProps(entry.object) : collectionProps(entry.prefix);
}

export function generatePropfindResponse(props: WebDAVProps[]): string {
  const responses = props.map((prop) => generatePropResponse(prop)).join('\n');
  return `<?xml version="1.0" encoding="utf-8" ?>
  <D:multistatus xmlns:D="DAV:">
${responses}
  </D:multistatus>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generatePropResponse(prop: WebDAVProps): string {
  return `  <D:response>
    <D:href>${prop.href}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(prop.displayname)}</D:displayname>
        <D:creationdate>${prop.creationdate}</D:creationdate>
        <D:getcontentlength>${prop.getcontentlength}</D:getcontentlength>
        <D:getcontenttype>${escapeXml(prop.getcontenttype || '')}</D:getcontenttype>
        <D:getetag>${escapeXml(prop.getetag || '')}</D:getetag>
        <D:getlastmodified>${prop.getlastmodified}</D:getlastmodified>
        <D:resourcetype>${prop.resourcetype === 'collection' ? '<D:collection/>' : ''}</D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
}
