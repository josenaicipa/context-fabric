import type { ContextChunk, ContextRequest } from "./schemas.js";

export interface AssemblePayload {
  request: ContextRequest;
  chunks: ContextChunk[];
}

export interface DebugHtmlPayload extends AssemblePayload {
  responseFormat: "html";
}

export function createAssemblePayload(request: ContextRequest, chunks: ContextChunk[]): AssemblePayload {
  return { request, chunks };
}

export function createDebugHtmlPayload(request: ContextRequest, chunks: ContextChunk[]): DebugHtmlPayload {
  return { request, chunks, responseFormat: "html" };
}
