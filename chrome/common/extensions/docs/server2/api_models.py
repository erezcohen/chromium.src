# Copyright 2013 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import os
import posixpath

from compiled_file_system import SingleFile, Unicode
from extensions_paths import API, CHROME_API
from file_system import FileNotFoundError
from future import Gettable, Future
from schema_util import ProcessSchema
from third_party.json_schema_compiler.model import Namespace, UnixName


@SingleFile
@Unicode
def _CreateAPIModel(path, data):
  schema = ProcessSchema(path, data)[0]
  if not schema: return None
  return Namespace(schema, schema['namespace'])


class APIModels(object):
  '''Tracks APIs and their Models.
  '''

  def __init__(self, features_bundle, compiled_fs_factory, file_system):
    self._features_bundle = features_bundle
    self._model_cache = compiled_fs_factory.Create(
        file_system, _CreateAPIModel, APIModels)
    self._file_system = file_system

  def GetNames(self):
    # API names appear alongside some of their methods/events/etc in the
    # features file. APIs are those which either implicitly or explicitly have
    # no parent feature (e.g. app, app.window, and devtools.inspectedWindow are
    # APIs; runtime.onConnectNative is not).
    api_features = self._features_bundle.GetAPIFeatures().Get()
    return [name for name, feature in api_features.iteritems()
            if ('.' not in name or
                name.rsplit('.', 1)[0] not in api_features or
                feature.get('noparent'))]

  def GetModel(self, api_name):
    # Callers sometimes specify a filename which includes .json or .idl - if
    # so, believe them. They may even include the 'api/' prefix.
    if os.path.splitext(api_name)[1] in ('.json', '.idl'):
      if not api_name.startswith((API, CHROME_API)):
        api_path = posixpath.join(API, api_name)
        if self._file_system.Exists(api_path).Get():
          return self._model_cache.GetFromFile(api_path)
        api_name = posixpath.join(CHROME_API, api_name)
      return self._model_cache.GetFromFile(api_name)

    assert not api_name.startswith((API, CHROME_API))

    # API names are given as declarativeContent and app.window but file names
    # will be declarative_content and app_window.
    file_name = UnixName(api_name).replace('.', '_')
    # Devtools APIs are in API/devtools/ not API/, and have their
    # "devtools" names removed from the file names.
    basename = posixpath.basename(file_name)
    if 'devtools_' in basename:
      file_name = posixpath.join(
          'devtools', file_name.replace(basename,
                                        basename.replace('devtools_' , '')))

    futures = [self._model_cache.GetFromFile(
                   posixpath.join(api_path, '%s.%s' % (file_name, ext)))
               for ext in ('json', 'idl')
               for api_path in (API, CHROME_API)]
    def resolve():
      for future in futures:
        try:
          return future.Get()
        except FileNotFoundError: pass
      # Propagate the first FileNotFoundError if no files were found.
      futures[0].Get()
    return Future(delegate=Gettable(resolve))

  def IterModels(self):
    future_models = [(name, self.GetModel(name)) for name in self.GetNames()]
    for name, future_model in future_models:
      try:
        model = future_model.Get()
      except FileNotFoundError:
        continue
      if model:
        yield name, model
