#!/bin/bash

# Sentinel AI - Deployment Script
# This script builds the app and uploads it to the server via FTP.

echo "🚀 Starting deployment to aiapp.nasadef.com.my..."

# 1. Build the Angular app
echo "📦 Building Angular application..."
npm run build

# 2. Prepare files for upload
# The build output is in dist/browser/
# We will upload the contents of dist/browser/ to the server.

# 3. Upload via FTP
# Note: You need 'lftp' installed on your machine to run this script.
# If you don't have lftp, you can use a standard FTP client.

HOST="ftp.nasadef.com.my"
USER="razif@nasadef.com.my"
PASS="Nikrazif@1"
REMOTE_DIR="/" # Adjust if you need to upload to a specific subdirectory

echo "📤 Uploading files to $HOST..."

lftp -f <<EOF
open $HOST
user $USER $PASS
mirror -R dist/browser/ $REMOTE_DIR
bye
EOF

echo "✅ Deployment complete! Visit http://aiapp.nasadef.com.my"
