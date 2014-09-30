#!/bin/bash
# Copyright 2014 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# This script does some preparations before build of instrumented libasound2.

# Instructions from the INSTALL file.
libtoolize --force --copy --automake
aclocal
autoheader
autoconf
automake --foreign --copy --add-missing
