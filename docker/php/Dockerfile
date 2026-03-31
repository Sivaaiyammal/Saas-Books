FROM php:8.2-fpm

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN apt-get update \
	&& apt-get install -y --no-install-recommends git unzip \
	&& docker-php-ext-install pdo_mysql mysqli \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html