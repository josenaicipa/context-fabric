# API client payloads

`createAssemblePayload(request, chunks)` produces the JSON body for `/assemble`. `createDebugHtmlPayload(request, chunks)` adds `responseFormat: "html"` for clients that route the same body to `/debug/html`. These helpers expose only public JSON contracts, not private implementation code.
