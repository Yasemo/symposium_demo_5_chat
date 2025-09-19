# Use the official Deno runtime as a parent image
FROM denoland/deno:1.40.2

# Set the working directory in the container
WORKDIR /app

# Copy the dependency files first (for better caching)
COPY deno.json deno.lock ./

# Cache the dependencies
RUN deno cache --lock=deno.lock deno.json

# Copy the rest of the application code
COPY . .

# Cache the main application and its dependencies
RUN deno cache --lock=deno.lock server.js

# Create a non-root user for security
RUN groupadd -r denouser && useradd -r -g denouser denouser
RUN chown -R denouser:denouser /app
USER denouser

# Expose the port that the app runs on
EXPOSE 8000

# Set environment variables for production
ENV DENO_ENV=production

# Run the application
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "--allow-ffi", "server.js"]
