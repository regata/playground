# Object Detection with Tensorflow

## Build image

```bash
# From playground/object_detection/
docker build -t object_detection .
```

## Download dataset and models

We assume the data is in `~/data/object_detection`
* 2012 PASCAL VOC: http://host.robots.ox.ac.uk/pascal/VOC/voc2012/VOCtrainval_11-May-2012.tar
* Pre-trained models: https://github.com/tensorflow/models/blob/master/object_detection/g3doc/detection_model_zoo.md

## Run Container

```bash
docker run --rm -it -p 8888:8888 -v ~/data/object_detection:/data object_detection bash
```

## Prepare data

```bash
# From /tensorflow/models/object_detection
python create_pascal_tf_record.py --data_dir=/data/VOCdevkit --year=VOC2012 --set=train --output_path=/data/tfrecords/pascal_train.record
python create_pascal_tf_record.py --data_dir=/data/VOCdevkit --year=VOC2012 --set=val --output_path=/data/tfrecords/pascal_val.record
```

## Fine-tune model

```bash
# From /tensorflow/models
python object_detection/train.py \
    --logtostderr \
    --pipeline_config_path=/tensorflow/ssd_inception_v2_pascal.config \
    --train_dir=/data/models/custom
```
