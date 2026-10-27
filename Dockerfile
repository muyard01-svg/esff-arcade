FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# la base (tickets, pseudos, scores) vit sur un volume monté en /data
ENV ESFF_DB=/data/arcade.db \
    PYTHONUNBUFFERED=1
EXPOSE 8090
CMD ["python", "server.py"]
