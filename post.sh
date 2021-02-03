#!/bin/sh

curl -v -X POST -d @addSlowly.json http://localhost:8123/rpc --header "Content-Type:application/json"

