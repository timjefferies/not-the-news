# Use an official Python runtime as a parent image
FROM python:3.8-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any dependencies needed for your script
RUN pip install --no-cache-dir -r requirements.txt

# Expose port 80
EXPOSE 80

# Create a cron schedule (e.g., every 15 minutes)
RUN echo "*/15 * * * * /usr/bin/python /app/run.py > /app/rss_feed.xml 2>&1" > /etc/cron.d/mycron

# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/mycron

# Apply cron job
RUN crontab /etc/cron.d/mycron

# Create a simple Flask web server
COPY server.py /app/server.py

# Run the cron job and start the Flask app on port 80
CMD cron && python /app/server.py

