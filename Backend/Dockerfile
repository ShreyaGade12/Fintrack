# Use an official Node.js runtime as a parent image
# We choose a specific version (e.g., 20-alpine) for stability and smaller image size
FROM node:20-alpine

# Set the working directory inside the container
# All subsequent commands will be executed relative to this directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) to the working directory
# This step is done separately to leverage Docker's layer caching.
# If only package.json changes, npm install layer is rebuilt. If source code changes, npm install layer is reused.
COPY package*.json ./

# Install application dependencies
# The --omit=dev flag ensures devDependencies are not installed in the production image
RUN npm install --omit=dev

# Copy the rest of the application source code to the working directory
# This includes your server.js, routes, models, services, middleware, etc.
COPY . .

# IMPORTANT: Handle Firebase Service Account Key securely
# For production, it's best to pass this via Kubernetes Secrets or Azure Key Vault.
# For Docker build, you can ensure your .env file is copied, but for production
# deployments, environment variables are preferred over files for secrets.
# Ensure your .env has FIREBASE_SERVICE_ACCOUNT_KEY or serviceAccountKey.json is copied.
# If you are using serviceAccountKey.json directly, ensure it's in the root of your backend folder
# and is included by the COPY . . command.
# For production, consider using Docker secrets or Kubernetes secrets for this.

# Expose the port your Node.js application listens on
# This should match the PORT defined in your .env or server.js (default 5000)
EXPOSE 5000

# Define the command to run your application
# 'npm start' assumes you have a "start" script in your package.json
# Alternatively, you can use 'node server.js'
CMD [ "node", "server.js" ]

# Best practices:
# - Use .dockerignore to exclude node_modules, .env, and other unnecessary files.
# - Use multi-stage builds for smaller production images (e.g., build frontend, then copy artifact).
