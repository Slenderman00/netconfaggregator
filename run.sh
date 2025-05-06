podman build -t postgres-netconfaggregator .
podman run -p 5433:5432 -p 3001:3001 -v $(pwd):/app postgres-netconfaggregator