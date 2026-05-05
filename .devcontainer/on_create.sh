#!/bin/bash

echo "========= Setup permission =========="
sudo chown -R node:node ${CONTAINER_WORKSPACE_FOLDER}/node_modules

echo "========= Setup alias =========="
cat << EOF >> ~/.bashrc 
alias ll='ls -l'
alias la='ls -A'
alias l='ls -CF'
EOF

echo "========= Node version =========="
node --version

echo "========= NPM version =========="
npm --version

echo "=========================="
echo "Finish ! on create"
echo "=========================="
