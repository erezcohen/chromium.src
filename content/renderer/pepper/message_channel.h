// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CONTENT_RENDERER_PEPPER_MESSAGE_CHANNEL_H_
#define CONTENT_RENDERER_PEPPER_MESSAGE_CHANNEL_H_

#include <deque>
#include <list>
#include <map>

#include "base/basictypes.h"
#include "base/memory/weak_ptr.h"
#include "gin/handle.h"
#include "gin/interceptor.h"
#include "gin/wrappable.h"
#include "ppapi/shared_impl/resource.h"
#include "third_party/WebKit/public/web/WebSerializedScriptValue.h"
#include "v8/include/v8.h"

struct PP_Var;

namespace gin {
class Arguments;
}  // namespace gin

namespace ppapi {
class ScopedPPVar;
}  // namespace ppapi

namespace content {

class PepperPluginInstanceImpl;
class PluginObject;

// MessageChannel implements bidirectional postMessage functionality, allowing
// calls from JavaScript to plugins and vice-versa. See
// PPB_Messaging::PostMessage and PPP_Messaging::HandleMessage for more
// information.
//
// Currently, only 1 MessageChannel can exist, to implement postMessage
// functionality for the instance interfaces.  In the future, when we create a
// MessagePort type in PPAPI, those may be implemented here as well with some
// refactoring.
//   - Separate message ports won't require the passthrough object.
//   - The message target won't be limited to instance, and should support
//     either plugin-provided or JS objects.
// TODO(dmichael):  Add support for separate MessagePorts.
class MessageChannel : public gin::Wrappable<MessageChannel>,
                       public gin::NamedPropertyInterceptor {
 public:
  static gin::WrapperInfo kWrapperInfo;

  // Creates a MessageChannel, returning a pointer to it and sets |result| to
  // the v8 object which is backed by the message channel. The returned pointer
  // is only valid as long as the object in |result| is alive.
  static MessageChannel* Create(PepperPluginInstanceImpl* instance,
                                v8::Persistent<v8::Object>* result);

  virtual ~MessageChannel();

  // Called when the instance is deleted. The MessageChannel might outlive the
  // plugin instance because it is garbage collected.
  void InstanceDeleted();

  // Post a message to the onmessage handler for this channel's instance
  // asynchronously.
  void PostMessageToJavaScript(PP_Var message_data);

  // Messages are queued initially. After the PepperPluginInstanceImpl is ready
  // to send and handle messages, users of MessageChannel should call
  // Start().
  void Start();

  // Set the V8Object to which we should forward any calls which aren't
  // related to postMessage. Note that this can be empty; it only gets set if
  // there is a scriptable 'InstanceObject' associated with this channel's
  // instance.
  void SetPassthroughObject(v8::Handle<v8::Object> passthrough);

  PepperPluginInstanceImpl* instance() { return instance_; }

  void SetReadOnlyProperty(PP_Var key, PP_Var value);

 private:
  // Struct for storing the result of a v8 object being converted to a PP_Var.
  struct VarConversionResult;

  explicit MessageChannel(PepperPluginInstanceImpl* instance);

  // gin::NamedPropertyInterceptor
  virtual v8::Local<v8::Value> GetNamedProperty(
      v8::Isolate* isolate,
      const std::string& property) OVERRIDE;
  virtual bool SetNamedProperty(v8::Isolate* isolate,
                                const std::string& property,
                                v8::Local<v8::Value> value) OVERRIDE;
  virtual std::vector<std::string> EnumerateNamedProperties(
      v8::Isolate* isolate) OVERRIDE;

  // gin::Wrappable
  virtual gin::ObjectTemplateBuilder GetObjectTemplateBuilder(
      v8::Isolate* isolate) OVERRIDE;

  // Post a message to the plugin's HandleMessage function for this channel's
  // instance.
  void PostMessageToNative(gin::Arguments* args);
  // Post a message to the plugin's HandleBlocking Message function for this
  // channel's instance synchronously, and return a result.
  void PostBlockingMessageToNative(gin::Arguments* args);

  // Post a message to the onmessage handler for this channel's instance
  // synchronously.  This is used by PostMessageToJavaScript.
  void PostMessageToJavaScriptImpl(
      const blink::WebSerializedScriptValue& message_data);

  PluginObject* GetPluginObject(v8::Isolate* isolate);

  void EnqueuePluginMessage(v8::Handle<v8::Value> v8_value);

  void FromV8ValueComplete(VarConversionResult* result_holder,
                           const ppapi::ScopedPPVar& result_var,
                           bool success);

  void DrainCompletedPluginMessages();
  void DrainEarlyMessageQueue();

  PepperPluginInstanceImpl* instance_;

  // We pass all non-postMessage calls through to the passthrough_object_.
  // This way, a plugin can use PPB_Class or PPP_Class_Deprecated and also
  // postMessage.  This is necessary to support backwards-compatibility, and
  // also trusted plugins for which we will continue to support synchronous
  // scripting.
  v8::Persistent<v8::Object> passthrough_object_;

  std::deque<blink::WebSerializedScriptValue> early_message_queue_;
  enum EarlyMessageQueueState {
    QUEUE_MESSAGES,  // Queue JS messages.
    SEND_DIRECTLY,   // Post JS messages directly.
  };
  EarlyMessageQueueState early_message_queue_state_;

  // This queue stores vars that are being sent to the plugin. Because
  // conversion can happen asynchronously for object types, the queue stores
  // the var until all previous vars have been converted and sent. This
  // preserves the order in which JS->plugin messages are processed.
  //
  // Note we rely on raw VarConversionResult* pointers remaining valid after
  // calls to push_back or pop_front; hence why we're using list. (deque would
  // probably also work, but is less clearly specified).
  std::list<VarConversionResult> plugin_message_queue_;

  std::map<std::string, ppapi::ScopedPPVar> internal_named_properties_;

  // This is used to ensure pending tasks will not fire after this object is
  // destroyed.
  base::WeakPtrFactory<MessageChannel> weak_ptr_factory_;

  DISALLOW_COPY_AND_ASSIGN(MessageChannel);
};

}  // namespace content

#endif  // CONTENT_RENDERER_PEPPER_MESSAGE_CHANNEL_H_
