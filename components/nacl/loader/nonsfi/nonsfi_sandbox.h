// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef COMPONENTS_NACL_LOADER_NONSFI_NONSFI_SANDBOX_H_
#define COMPONENTS_NACL_LOADER_NONSFI_NONSFI_SANDBOX_H_

#include "base/basictypes.h"
#include "base/files/scoped_file.h"
#include "sandbox/linux/bpf_dsl/bpf_dsl_forward.h"
#include "sandbox/linux/bpf_dsl/policy.h"

namespace nacl {
namespace nonsfi {

// The seccomp sandbox policy for NaCl non-SFI mode. Note that this
// policy must be as strong as possible, as non-SFI mode heavily
// depends on seccomp sandbox.
class NaClNonSfiBPFSandboxPolicy : public sandbox::bpf_dsl::Policy {
 public:
  explicit NaClNonSfiBPFSandboxPolicy() {}
  ~NaClNonSfiBPFSandboxPolicy() override {}

  sandbox::bpf_dsl::ResultExpr EvaluateSyscall(int sysno) const override;
  sandbox::bpf_dsl::ResultExpr InvalidSyscall() const override;

 private:
  DISALLOW_COPY_AND_ASSIGN(NaClNonSfiBPFSandboxPolicy);
};

// Initializes seccomp-bpf sandbox for non-SFI NaCl. Returns false on
// failure.
bool InitializeBPFSandbox(base::ScopedFD proc_task_fd);

}  // namespace nonsfi
}  // namespace nacl

#endif  // COMPONENTS_NACL_LOADER_NONSFI_NONSFI_SANDBOX_H_
