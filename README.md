Denby
=====

Welcome! Consider yourself warned. :-)

## Components

### Denby

Web interface, currently focused on a multi-column "death star console" style client, but eventually work will be done on multiple user interface and device profiles.

### Proxy (per-client)

Socket.IO (and JSON-RPC-over-SIO) interface between Denby and Ripley, plus the web service frontend. While Ripley is entirely in-process, the web service frontend is where the entire server starts.

[lib/proxy.js](https://github.com/jdub/denby/blob/master/lib/proxy.js)
[server.js](https://github.com/jdub/denby/blob/master/server.js)

### Ripley (singular)

Twitter user/site streams manager and future destination for all the cool 'cloud' features.

Mostly ignored at this point, as the recently refactored Proxy is just making its own userstreams connection for now. Ripley will again be responsible for all stream management once the sitestreams work is merged in.

[lib/ripley.js](https://github.com/jdub/denby/blob/master/lib/ripley.js)
