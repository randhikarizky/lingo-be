#!/bin/sh
set -e
node ./node_modules/prisma/build/index.js migrate deploy
node prisma/seed.runtime.cjs
exec node server.js
