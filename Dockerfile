FROM --platform=amd64 python:3.8.16-slim

ENV FLASK_APP=run
# ENV DATABASE=data/database.db

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY requirements.txt ./

RUN python -m pip install --upgrade pip
RUN pip install -r requirements.txt
RUN pip install gunicorn

# Bundle app source
COPY . .

# RUN flask init-db

EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "run:app"]
