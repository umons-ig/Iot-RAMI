#!/bin/sh

# On cherche récursivement dans /usr/share/nginx/html les fichiers .js
# et on remplace VITE_APP_BACK_URL_PLACEHOLDER par la variable d'env VITE_APP_BACK_URL
# On fait de même pour le socket si besoin

echo "Replacing placeholders in JS files..."

find /usr/share/nginx/html -name "*.js" -exec sed -i "s|VITE_APP_BACK_URL_PLACEHOLDER|$VITE_APP_BACK_URL|g" {} +
find /usr/share/nginx/html -name "*.js" -exec sed -i "s|VITE_SOCKET_URL_PLACEHOLDER|$VITE_SOCKET_URL|g" {} +

echo "Done. Starting Nginx..."

exec "$@"
