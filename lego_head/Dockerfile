FROM jupyter/base-notebook:notebook-6.0.0

USER root

RUN apt-get update && apt-get -yq dist-upgrade \
    && apt-get install -yq --no-install-recommends \
        libcairo2 \
    && rm -rf /var/lib/apt/lists/*

USER $NB_UID

RUN pip install drawSvg svgwrite
