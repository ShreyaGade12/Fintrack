# --- Stage 1: Build the React application ---
# Use an official Node.js runtime for building
FROM node:20-alpine as builder

# Set the working directory inside the container for the build stage
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install build dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the React application
# 'npm run build' generates optimized static assets in the 'build' folder
RUN npm run build

# --- Stage 2: Serve the React application with Nginx ---
# Use a lightweight Nginx image as a base for the final production image
FROM nginx:alpine

# Copy the built React app from the builder stage to Nginx's default public directory
COPY --from=builder /app/build /usr/share/nginx/html

# Remove default Nginx configuration and copy a custom one
# This custom config is crucial for React Router to work correctly on page refreshes
# without needing a backend route for every path.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port Nginx listens on (default HTTP port)
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
