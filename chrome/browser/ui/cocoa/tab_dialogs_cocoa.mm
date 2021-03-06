// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/cocoa/tab_dialogs_cocoa.h"

#import "chrome/browser/ui/cocoa/content_settings/collected_cookies_mac.h"
#import "chrome/browser/ui/cocoa/hung_renderer_controller.h"
#import "chrome/browser/ui/cocoa/passwords/manage_passwords_bubble_cocoa.h"
#import "chrome/browser/ui/cocoa/profiles/profile_signin_confirmation_dialog_cocoa.h"
#include "content/public/browser/web_contents.h"

// static
void TabDialogs::CreateForWebContents(content::WebContents* contents) {
  DCHECK(contents);
  if (!FromWebContents(contents))
    contents->SetUserData(UserDataKey(), new TabDialogsCocoa(contents));
}

TabDialogsCocoa::TabDialogsCocoa(content::WebContents* contents)
    : web_contents_(contents) {
  DCHECK(contents);
}

TabDialogsCocoa::~TabDialogsCocoa() {
}

void TabDialogsCocoa::ShowCollectedCookies() {
  // Deletes itself on close.
  new CollectedCookiesMac(web_contents_);
}

void TabDialogsCocoa::ShowHungRendererDialog() {
  [HungRendererController showForWebContents:web_contents_];
}

void TabDialogsCocoa::HideHungRendererDialog() {
  [HungRendererController endForWebContents:web_contents_];
}

void TabDialogsCocoa::ShowProfileSigninConfirmation(
    Browser* browser,
    Profile* profile,
    const std::string& username,
    ui::ProfileSigninConfirmationDelegate* delegate) {
  ProfileSigninConfirmationDialogCocoa::Show(
      browser, web_contents_, profile, username, delegate);
}

void TabDialogsCocoa::ShowManagePasswordsBubble(bool user_action) {
  ManagePasswordsBubbleCocoa::Show(web_contents_, user_action);
}

void TabDialogsCocoa::HideManagePasswordsBubble() {
  // The bubble is closed when it loses the focus.
}
