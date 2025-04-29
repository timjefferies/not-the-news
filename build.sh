git pull && \
	sudo docker rm -f ntn && \
	sudo docker container prune -f && \
	sudo docker image prune -f && \
	sudo docker builder prune -f && \
	sudo docker buildx build --build-arg DOMAIN=news.loveopenly.net --build-arg EMAIL=admin@loveopenly.net -t not-the-news . && \
	docker buildx rm caddy-builder --all-inactive --force \
	sudo docker run -d -p 80:80 -p 443:443 -v not-the-news_volume:/data --name ntn not-the-news

