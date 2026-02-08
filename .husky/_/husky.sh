#!/usr/bin/env sh
if [ -z "$HUSKY" ]; then
  export HUSKY=1
fi

hook_name="$(basename -- "$0")"
if [ -n "$HUSKY_DEBUG" ]; then
  echo "husky > running $hook_name" >&2
fi
