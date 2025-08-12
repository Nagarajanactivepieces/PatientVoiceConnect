#!/bin/bash
echo "Starting ngrok tunnel..."
ngrok http 3000 --authtoken $NGROK_AUTH_TOKEN