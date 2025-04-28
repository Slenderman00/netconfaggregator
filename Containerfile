FROM node

ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_DB=xml
ENV PGDATA=/var/lib/postgresql/data

RUN apt-get update && apt-get install -y \
    git \
    postgresql \
    postgresql-contrib \
    procps \
    sudo \
    autoconf \
    automake \
    pkg-config \
    gcc \
    libtool \
    libxml2-dev \
    libssh2-1-dev \
    make \
    libncurses5-dev \
    zlib1g-dev \
    libreadline-dev \
    libssl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Slenderman00/yuma123.git
WORKDIR /yuma123
RUN autoreconf -i -f
RUN ./configure CFLAGS='-g -O0' CXXFLAGS='-g -O0' --prefix=/usr
RUN make
RUN sudo make install

RUN npm install -g nodemon

RUN mkdir -p "$PGDATA" && chown -R postgres:postgres "$PGDATA" && chmod 700 "$PGDATA"

RUN echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/15/main/pg_hba.conf && \
    echo "listen_addresses='*'" >> /etc/postgresql/15/main/postgresql.conf

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 5432 3000

RUN echo '#!/bin/bash\n\
service postgresql start\n\
until pg_isready -h 127.0.0.1 -p 5432 -U postgres; do\n\
    echo "Waiting for PostgreSQL to be ready..."\n\
    service postgresql status\n\
    sleep 2\n\
done\n\
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '"'"'$POSTGRES_PASSWORD'"'"';"\n\
sudo -u postgres psql -c "CREATE DATABASE $POSTGRES_DB;"\n\
npx prisma migrate dev --name init;\n\
npm start\n\
' > /start.sh && chmod +x /start.sh

ENTRYPOINT ["/start.sh"]