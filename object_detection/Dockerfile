FROM gcr.io/tensorflow/tensorflow

# https://github.com/tensorflow/models/blob/master/object_detection/g3doc/installation.md
RUN apt-get update && \
    apt-get install -y --no-install-recommends \ 
        protobuf-compiler \
        python-pil \
        python-lxml \
        git \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir /tensorflow

WORKDIR /tensorflow
RUN git clone https://github.com/tensorflow/models.git
RUN cd models/ && protoc object_detection/protos/*.proto --python_out=.

ENV PYTHONPATH $PYTHONPATH:/tensorflow/models:/tensorflow/models/slim

COPY ./ssd_inception_v2_pascal.config /tensorflow

WORKDIR /