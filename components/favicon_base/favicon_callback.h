// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef COMPONENTS_FAVICON_BASE_FAVICON_CALLBACK_H_
#define COMPONENTS_FAVICON_BASE_FAVICON_CALLBACK_H_

#include <vector>

#include "base/callback.h"

namespace favicon_base {

struct FaviconRawBitmapResult;
struct FaviconImageResult;

// Callback for functions that can be used to return a |gfx::Image| and the
// |GURL| it is loaded from. They are returned as a |FaviconImageResult| object.
typedef base::Callback<void(const FaviconImageResult&)> FaviconImageCallback;

// Callback for functions returning raw data for a favicon. In
// |FaviconRawBitmapResult|, the data is not yet converted as a |gfx::Image|.
typedef base::Callback<void(const FaviconRawBitmapResult&)>
    FaviconRawBitmapCallback;

// Callback for functions returning raw data for a favicon in multiple
// resolution. In |FaviconRawBitmapResult|, the data is not yet converted as a
// |gfx::Image|.
typedef base::Callback<void(const std::vector<FaviconRawBitmapResult>&)>
    FaviconResultsCallback;

}  // namespace favicon_base

#endif  // COMPONENTS_FAVICON_BASE_FAVICON_CALLBACK_H_
