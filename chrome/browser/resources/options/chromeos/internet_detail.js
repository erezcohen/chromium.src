// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// require: onc_data.js

// NOTE(stevenjb): This code is in the process of being converted to be
// compatible with the networkingPrivate extension API:
// * The network property dictionaries are being converted to use ONC values.
// * chrome.send calls will be replaced with an API object that simulates the
//   networkingPrivate API. See network_config.js.
// See crbug.com/279351 for more info.

cr.define('options.internet', function() {
  var OncData = cr.onc.OncData;
  var Page = cr.ui.pageManager.Page;
  var PageManager = cr.ui.pageManager.PageManager;
  /** @const */ var IPAddressField = options.internet.IPAddressField;

  /** @const */ var GoogleNameServersString = '8.8.4.4,8.8.8.8';

  /**
   * Helper function to set hidden attribute for elements matching a selector.
   * @param {string} selector CSS selector for extracting a list of elements.
   * @param {bool} hidden New hidden value.
   */
  function updateHidden(selector, hidden) {
    var elements = cr.doc.querySelectorAll(selector);
    for (var i = 0, el; el = elements[i]; i++) {
      el.hidden = hidden;
    }
  }

  /**
   * Helper function to update the properties of the data object from the
   * properties in the update object.
   * @param {Object} data Object to update.
   * @param {Object} update Object containing the updated properties.
   */
  function updateDataObject(data, update) {
    for (var prop in update) {
      if (prop in data)
        data[prop] = update[prop];
    }
  }

  /**
   * Monitor pref change of given element.
   * @param {Element} el Target element.
   */
  function observePrefsUI(el) {
    Preferences.getInstance().addEventListener(el.pref, handlePrefUpdate);
  }

  /**
   * UI pref change handler.
   * @param {Event} e The update event.
   */
  function handlePrefUpdate(e) {
    DetailsInternetPage.getInstance().updateControls();
  }

  /**
   * Simple helper method for converting a field to a string. It is used to
   * easily assign an empty string from fields that may be unknown or undefined.
   * @param {object} value that should be converted to a string.
   * @return {string} the result.
   */
  function stringFromValue(value) {
    return value ? String(value) : '';
  }

  /**
   * Sends the 'checked' state of a control to chrome for a network.
   * @param {string} path The service path of the network.
   * @param {string} message The message to send to chrome.
   * @param {HTMLInputElement} checkbox The checkbox storing the value to send.
   */
  function sendCheckedIfEnabled(path, message, checkbox) {
    if (!checkbox.hidden && !checkbox.disabled)
      chrome.send(message, [path, checkbox.checked ? 'true' : 'false']);
  }

  /**
   * Returns the netmask as a string for a given prefix length.
   * @param {string} prefixLength The ONC routing prefix length.
   * @return {string} The corresponding netmask.
   */
  function PrefixLengthToNetmask(prefixLength) {
    // Return the empty string for invalid inputs.
    if (prefixLength < 0 || prefixLength > 32)
      return '';
    var netmask = '';
    for (var i = 0; i < 4; ++i) {
      var remainder = 8;
      if (prefixLength >= 8) {
        prefixLength -= 8;
      } else {
        remainder = prefixLength;
        prefixLength = 0;
      }
      if (i > 0)
        netmask += '.';
      var value = 0;
      if (remainder != 0)
        value = ((2 << (remainder - 1)) - 1) << (8 - remainder);
      netmask += value.toString();
    }
    return netmask;
  }

  /////////////////////////////////////////////////////////////////////////////
  // DetailsInternetPage class:

  /**
   * Encapsulated handling of ChromeOS internet details overlay page.
   * @constructor
   */
  function DetailsInternetPage() {
    Page.call(this, 'detailsInternetPage', null, 'details-internet-page');
  }

  cr.addSingletonGetter(DetailsInternetPage);

  DetailsInternetPage.prototype = {
    __proto__: Page.prototype,

    /** @override */
    initializePage: function() {
      Page.prototype.initializePage.call(this);
      var params = parseQueryParams(window.location);
      this.initializePageContents_(params);
      this.showNetworkDetails_(params);
    },

    /**
     * Auto-activates the network details dialog if network information
     * is included in the URL.
     */
    showNetworkDetails_: function(params) {
      var servicePath = params.servicePath;
      if (!servicePath || !servicePath.length)
        return;
      var networkType = '';  // ignored for 'options'
      chrome.send('networkCommand', [networkType, servicePath, 'options']);
    },

    /**
     * Initializes the contents of the page.
     */
    initializePageContents_: function(params) {
      $('details-internet-dismiss').addEventListener('click', function(event) {
        DetailsInternetPage.setDetails();
      });

      $('details-internet-login').addEventListener('click', function(event) {
        DetailsInternetPage.setDetails();
        DetailsInternetPage.loginFromDetails();
      });

      $('details-internet-disconnect').addEventListener('click',
                                                        function(event) {
        DetailsInternetPage.setDetails();
        DetailsInternetPage.disconnectNetwork();
      });

      $('details-internet-configure').addEventListener('click',
                                                       function(event) {
        DetailsInternetPage.setDetails();
        DetailsInternetPage.configureNetwork();
      });

      $('activate-details').addEventListener('click', function(event) {
        DetailsInternetPage.activateFromDetails();
      });

      $('buyplan-details').addEventListener('click', function(event) {
        var data = $('connection-state').data;
        chrome.send('buyDataPlan', [data.servicePath]);
        PageManager.closeOverlay();
      });

      $('view-account-details').addEventListener('click', function(event) {
        var data = $('connection-state').data;
        chrome.send('showMorePlanInfo', [data.servicePath]);
        PageManager.closeOverlay();
      });

      $('cellular-apn-use-default').addEventListener('click', function(event) {
        var data = $('connection-state').data;
        var onc = $('connection-state').onc;
        var apnSelector = $('select-apn');

        if (data.userApnIndex != -1) {
          apnSelector.remove(data.userApnIndex);
          data.userApnIndex = -1;
        }

        var activeApn;
        var iApn = -1;
        var apnList = onc.getActiveValue('Cellular.APNList');
        if (apnList != undefined && apnList.length > 0) {
          iApn = 0;
          var defaultApn = apnList[iApn];
          activeApn['AccessPointName'] =
              stringFromValue(defaultApn['AccessPointName']);
          activeApn['Username'] = stringFromValue(defaultApn['Username']);
          activeApn['Password'] = stringFromValue(defaultApn['Password']);
          chrome.send('setApn', [data.servicePath,
                                 activeApn['AccessPointName'],
                                 activeApn['Username'],
                                 activeApn['Password']]);
        }
        onc.setManagedProperty('Cellular.APN', activeApn);
        apnSelector.selectedIndex = iApn;
        data.selectedApn = iApn;

        updateHidden('.apn-list-view', false);
        updateHidden('.apn-details-view', true);
      });

      $('cellular-apn-set').addEventListener('click', function(event) {
        if ($('cellular-apn').value == '')
          return;

        var data = $('connection-state').data;
        var onc = $('connection-state').onc;
        var apnSelector = $('select-apn');

        var activeApn = {};
        activeApn['AccessPointName'] =
            stringFromValue($('cellular-apn').value);
        activeApn['Username'] =
            stringFromValue($('cellular-apn-username').value);
        activeApn['Password'] =
            stringFromValue($('cellular-apn-password').value);
        onc.setManagedProperty('Cellular.APN', activeApn);
        data.userApn = activeApn;
        chrome.send('setApn', [data.servicePath,
                               activeApn['AccessPointName'],
                               activeApn['Username'],
                               activeApn['Password']]);

        if (data.userApnIndex != -1) {
          apnSelector.remove(data.userApnIndex);
          data.userApnIndex = -1;
        }

        var option = document.createElement('option');
        option.textContent = activeApn['AccessPointName'];
        option.value = -1;
        option.selected = true;
        apnSelector.add(option, apnSelector[apnSelector.length - 1]);
        data.userApnIndex = apnSelector.length - 2;
        data.selectedApn = data.userApnIndex;

        updateHidden('.apn-list-view', false);
        updateHidden('.apn-details-view', true);
      });

      $('cellular-apn-cancel').addEventListener('click', function(event) {
        $('select-apn').selectedIndex = $('connection-state').data.selectedApn;
        updateHidden('.apn-list-view', false);
        updateHidden('.apn-details-view', true);
      });

      $('select-apn').addEventListener('change', function(event) {
        var data = $('connection-state').data;
        var onc = $('connection-state').onc;
        var apnSelector = $('select-apn');
        var apnDict;
        if (apnSelector[apnSelector.selectedIndex].value != -1) {
          var apnList = onc.getActiveValue('Cellular.APNList');
          var apnIndex = apnSelector.selectedIndex;
          assert(apnIndex < apnList.length);
          apnDict = apnList[apnIndex];
          chrome.send('setApn', [data.servicePath,
                                 stringFromValue(apnDict['AccessPointName']),
                                 stringFromValue(apnDict['Username']),
                                 stringFromValue(apnDict['Password'])]);
          data.selectedApn = apnIndex;
        } else if (apnSelector.selectedIndex == data.userApnIndex) {
          apnDict = data.userApn;
          chrome.send('setApn', [data.servicePath,
                                 stringFromValue(apnDict['AccessPointName']),
                                 stringFromValue(apnDict['Username']),
                                 stringFromValue(apnDict['Password'])]);
          data.selectedApn = apnSelector.selectedIndex;
        } else {
          apnDict = onc.getActiveValue('Cellular.APN');
          $('cellular-apn').value = stringFromValue(apnDict['AccessPointName']);
          $('cellular-apn-username').value =
              stringFromValue(apnDict['Username']);
          $('cellular-apn-password').value =
              stringFromValue(apnDict['Password']);

          updateHidden('.apn-list-view', true);
          updateHidden('.apn-details-view', false);
        }
      });

      $('sim-card-lock-enabled').addEventListener('click', function(event) {
        var newValue = $('sim-card-lock-enabled').checked;
        // Leave value as is because user needs to enter PIN code first.
        // When PIN will be entered and value changed,
        // we'll update UI to reflect that change.
        $('sim-card-lock-enabled').checked = !newValue;
        chrome.send('setSimCardLock', [newValue]);
      });
      $('change-pin').addEventListener('click', function(event) {
        chrome.send('changePin');
      });

      // Proxy
      ['proxy-host-single-port',
       'secure-proxy-port',
       'socks-port',
       'ftp-proxy-port',
       'proxy-host-port'
      ].forEach(function(id) {
        options.PrefPortNumber.decorate($(id));
      });

      options.proxyexceptions.ProxyExceptions.decorate($('ignored-host-list'));
      $('remove-host').addEventListener('click',
                                        this.handleRemoveProxyExceptions_);
      $('add-host').addEventListener('click', this.handleAddProxyException_);
      $('direct-proxy').addEventListener('click', this.disableManualProxy_);
      $('manual-proxy').addEventListener('click', this.enableManualProxy_);
      $('auto-proxy').addEventListener('click', this.disableManualProxy_);
      $('proxy-all-protocols').addEventListener('click',
                                                this.toggleSingleProxy_);
      $('proxy-use-pac-url').addEventListener('change',
                                              this.handleAutoConfigProxy_);

      observePrefsUI($('direct-proxy'));
      observePrefsUI($('manual-proxy'));
      observePrefsUI($('auto-proxy'));
      observePrefsUI($('proxy-all-protocols'));
      observePrefsUI($('proxy-use-pac-url'));

      $('ip-automatic-configuration-checkbox').addEventListener('click',
        this.handleIpAutoConfig_);
      $('automatic-dns-radio').addEventListener('click',
        this.handleNameServerTypeChange_);
      $('google-dns-radio').addEventListener('click',
        this.handleNameServerTypeChange_);
      $('user-dns-radio').addEventListener('click',
        this.handleNameServerTypeChange_);

      // We only load this string if we have the string data available
      // because the proxy settings page on the login screen re-uses the
      // proxy sub-page from the internet options, and it doesn't ever
      // show the DNS settings, so we don't need this string there.
      // The string isn't available because
      // chrome://settings-frame/strings.js (where the string is
      // stored) is not accessible from the login screen.
      // TODO(pneubeck): Remove this once i18n of the proxy dialog on the login
      // page is fixed. http://crbug.com/242865
      if (loadTimeData.data_) {
        $('google-dns-label').innerHTML =
            loadTimeData.getString('googleNameServers');
      }
    },

    /**
     * Handler for "add" event fired from userNameEdit.
     * @param {Event} e Add event fired from userNameEdit.
     * @private
     */
    handleAddProxyException_: function(e) {
      var exception = $('new-host').value;
      $('new-host').value = '';

      exception = exception.trim();
      if (exception)
        $('ignored-host-list').addException(exception);
    },

    /**
     * Handler for when the remove button is clicked
     * @param {Event} e The click event.
     * @private
     */
    handleRemoveProxyExceptions_: function(e) {
      var selectedItems = $('ignored-host-list').selectedItems;
      for (var x = 0; x < selectedItems.length; x++) {
        $('ignored-host-list').removeException(selectedItems[x]);
      }
    },

    /**
     * Handler for when the IP automatic configuration checkbox is clicked.
     * @param {Event} e The click event.
     * @private
     */
    handleIpAutoConfig_: function(e) {
      var checked = $('ip-automatic-configuration-checkbox').checked;
      var fields = [$('ip-address'), $('ip-netmask'), $('ip-gateway')];
      for (var i = 0; i < fields.length; ++i) {
        fields[i].editable = !checked;
        if (checked) {
          var model = fields[i].model;
          model.value = model.automatic;
          fields[i].model = model;
        }
      }
      if (!checked)
        $('ip-address').focus();
    },

    /**
     * Handler for when the name server selection changes.
     * @param {Event} event The click event.
     * @private
     */
    handleNameServerTypeChange_: function(event) {
      var type = event.target.value;
      DetailsInternetPage.updateNameServerDisplay(type);
    },

    /**
     * Creates an indicator event for controlled properties using
     * the same dictionary format as CoreOptionsHandler::CreateValueForPref.
     * @param {string} name The name for the Event.
     * @param {!{value: *, controlledBy: *, recommendedValue: *}} propData
     *     Property dictionary,
     * @private
     */
    createControlledEvent_: function(name, propData) {
      var event = new Event(name);
      event.value = {
        value: propData.value,
        controlledBy: propData.controlledBy,
        recommendedValue: propData.recommendedValue
      };
      return event;
    },

    /**
     * Creates an indicator event for controlled properties using
     * the ONC getManagedProperties dictionary format.
     * @param {string} name The name for the Event.
     * @param {Object} propData ONC managed network property dictionary.
     * @private
     */
    createManagedEvent_: function(name, propData) {
      var event = new Event(name);
      event.value = {};

      // Set the current value and recommended value.
      var activeValue = propData['Active'];
      var effective = propData['Effective'];
      if (activeValue == undefined)
        activeValue = propData[effective];
      event.value.value = activeValue;

      // If a property is editable then it is not enforced, and 'controlledBy'
      // is set to 'recommended' unless effective == {User|Shared}Setting, in
      // which case the value was modifed from the recommended value.
      // Otherwise if 'Effective' is set to 'UserPolicy' or 'DevicePolicy' then
      // the set value is mandated by the policy.
      if (propData['UserEditable']) {
        if (effective == 'UserPolicy')
          event.value.controlledBy = 'recommended';
        event.value.recommendedValue = propData['UserPolicy'];
      } else if (propData['DeviceEditable']) {
        if (effective == 'DevicePolicy')
          event.value.controlledBy = 'recommended';
        event.value.recommendedValue = propData['DevicePolicy'];
      } else if (effective == 'UserPolicy' || effective == 'DevicePolicy') {
        event.value.controlledBy = 'policy';
      }

      return event;
    },

    /**
     * Update details page controls.
     */
    updateControls: function() {
      // Only show ipconfig section if network is connected OR if nothing on
      // this device is connected. This is so that you can fix the ip configs
      // if you can't connect to any network.
      // TODO(chocobo): Once ipconfig is moved to flimflam service objects,
      //   we need to redo this logic to allow configuration of all networks.
      $('ipconfig-section').hidden = !this.connected && this.deviceConnected;
      $('ipconfig-dns-section').hidden =
        !this.connected && this.deviceConnected;

      // Network type related.
      updateHidden('#details-internet-page .cellular-details',
                   this.type != 'Cellular');
      updateHidden('#details-internet-page .wifi-details',
                   this.type != 'WiFi');
      updateHidden('#details-internet-page .wimax-details',
                   this.type != 'Wimax');
      updateHidden('#details-internet-page .vpn-details', this.type != 'VPN');
      updateHidden('#details-internet-page .proxy-details', !this.showProxy);

      // Cellular

      // Conditionally call updateHidden on .gsm-only, so that we don't unhide
      // a previously hidden element.
      if (this.gsm)
        updateHidden('#details-internet-page .cdma-only', true);
      else
        updateHidden('#details-internet-page .gsm-only', true);

      // Wifi

      // Hide network tab for VPN.
      updateHidden('#details-internet-page .network-details',
                   this.type == 'VPN');

      // Password and shared.
      updateHidden('#details-internet-page #password-details',
                   this.type != 'WiFi' || !this.hasSecurity);
      updateHidden('#details-internet-page #wifi-shared-network',
          !this.shared);
      updateHidden('#details-internet-page #prefer-network',
                   !this.showPreferred);

      // WiMAX.
      updateHidden('#details-internet-page #wimax-shared-network',
                   !this.shared);

      // Proxy
      this.updateProxyBannerVisibility_();
      this.toggleSingleProxy_();
      if ($('manual-proxy').checked)
        this.enableManualProxy_();
      else
        this.disableManualProxy_();
    },

    /**
     * Updates info banner visibility state. This function shows the banner
     * if proxy is managed or shared-proxies is off for shared network.
     * @private
     */
    updateProxyBannerVisibility_: function() {
      var bannerDiv = $('network-proxy-info-banner');
      if (!loadTimeData.data_) {
        // TODO(pneubeck): This temporarily prevents an exception below until
        // i18n of the proxy dialog on the login page is
        // fixed. http://crbug.com/242865
        bannerDiv.hidden = true;
        return;
      }

      // Show banner and determine its message if necessary.
      var controlledBy = $('direct-proxy').controlledBy;
      if (!controlledBy || controlledBy == '') {
        bannerDiv.hidden = true;
      } else {
        bannerDiv.hidden = false;
        // The possible banner texts are loaded in proxy_handler.cc.
        var bannerText = 'proxyBanner' + controlledBy.charAt(0).toUpperCase() +
                         controlledBy.slice(1);
        $('banner-text').textContent = loadTimeData.getString(bannerText);
      }
    },

    /**
     * Handler for when the user clicks on the checkbox to allow a
     * single proxy usage.
     * @private
     * @param {Event} e Click Event.
     */
    toggleSingleProxy_: function(e) {
      if ($('proxy-all-protocols').checked) {
        $('multi-proxy').hidden = true;
        $('single-proxy').hidden = false;
      } else {
        $('multi-proxy').hidden = false;
        $('single-proxy').hidden = true;
      }
    },

    /**
     * Handler for when the user clicks on the checkbox to enter
     * auto configuration URL.
     * @private
     * @param {Event} e Click Event.
     */
    handleAutoConfigProxy_: function(e) {
      $('proxy-pac-url').disabled = !$('proxy-use-pac-url').checked;
    },

    /**
     * Handler for selecting a radio button that will disable the manual
     * controls.
     * @private
     * @param {Event} e Click event.
     */
    disableManualProxy_: function(e) {
      $('ignored-host-list').disabled = true;
      $('new-host').disabled = true;
      $('remove-host').disabled = true;
      $('add-host').disabled = true;
      $('proxy-all-protocols').disabled = true;
      $('proxy-host-name').disabled = true;
      $('proxy-host-port').disabled = true;
      $('proxy-host-single-name').disabled = true;
      $('proxy-host-single-port').disabled = true;
      $('secure-proxy-host-name').disabled = true;
      $('secure-proxy-port').disabled = true;
      $('ftp-proxy').disabled = true;
      $('ftp-proxy-port').disabled = true;
      $('socks-host').disabled = true;
      $('socks-port').disabled = true;
      $('proxy-use-pac-url').disabled = $('auto-proxy').disabled ||
                                        !$('auto-proxy').checked;
      $('proxy-pac-url').disabled = $('proxy-use-pac-url').disabled ||
                                    !$('proxy-use-pac-url').checked;
      $('auto-proxy-parms').hidden = !$('auto-proxy').checked;
      $('manual-proxy-parms').hidden = !$('manual-proxy').checked;
      chrome.send('coreOptionsUserMetricsAction',
                  ['Options_NetworkManualProxy_Disable']);
    },

    /**
     * Handler for selecting a radio button that will enable the manual
     * controls.
     * @private
     * @param {Event} e Click event.
     */
    enableManualProxy_: function(e) {
      $('ignored-host-list').redraw();
      var allDisabled = $('manual-proxy').disabled;
      $('ignored-host-list').disabled = allDisabled;
      $('new-host').disabled = allDisabled;
      $('remove-host').disabled = allDisabled;
      $('add-host').disabled = allDisabled;
      $('proxy-all-protocols').disabled = allDisabled;
      $('proxy-host-name').disabled = allDisabled;
      $('proxy-host-port').disabled = allDisabled;
      $('proxy-host-single-name').disabled = allDisabled;
      $('proxy-host-single-port').disabled = allDisabled;
      $('secure-proxy-host-name').disabled = allDisabled;
      $('secure-proxy-port').disabled = allDisabled;
      $('ftp-proxy').disabled = allDisabled;
      $('ftp-proxy-port').disabled = allDisabled;
      $('socks-host').disabled = allDisabled;
      $('socks-port').disabled = allDisabled;
      $('proxy-use-pac-url').disabled = true;
      $('proxy-pac-url').disabled = true;
      $('auto-proxy-parms').hidden = !$('auto-proxy').checked;
      $('manual-proxy-parms').hidden = !$('manual-proxy').checked;
      chrome.send('coreOptionsUserMetricsAction',
                  ['Options_NetworkManualProxy_Enable']);
    }
  };

  /**
   * Enables or Disables all buttons that provide operations on the cellular
   * network.
   */
  DetailsInternetPage.changeCellularButtonsState = function(disable) {
    var buttonsToDisableList =
        new Array('details-internet-login',
                  'details-internet-disconnect',
                  'details-internet-configure',
                  'activate-details',
                  'buyplan-details',
                  'view-account-details');

    for (var i = 0; i < buttonsToDisableList.length; ++i) {
      var button = $(buttonsToDisableList[i]);
      button.disabled = disable;
    }
  };

  /**
   * Shows a spinner while the carrier is changed.
   */
  DetailsInternetPage.showCarrierChangeSpinner = function(visible) {
    $('switch-carrier-spinner').hidden = !visible;
    // Disable any buttons that allow us to operate on cellular networks.
    DetailsInternetPage.changeCellularButtonsState(visible);
  };

  /**
   * Changes the network carrier.
   */
  DetailsInternetPage.handleCarrierChanged = function() {
    var carrierSelector = $('select-carrier');
    var carrier = carrierSelector[carrierSelector.selectedIndex].textContent;
    DetailsInternetPage.showCarrierChangeSpinner(true);
    var data = $('connection-state').data;
    chrome.send('setCarrier', [data.servicePath, carrier]);
  };

  /**
   * Performs minimal initialization of the InternetDetails dialog in
   * preparation for showing proxy-setttings.
   */
  DetailsInternetPage.initializeProxySettings = function() {
    var detailsPage = DetailsInternetPage.getInstance();
    detailsPage.initializePageContents_();
  };

  /**
   * Displays the InternetDetails dialog with only the proxy settings visible.
   */
  DetailsInternetPage.showProxySettings = function() {
    var detailsPage = DetailsInternetPage.getInstance();
    $('network-details-header').hidden = true;
    $('buyplan-details').hidden = true;
    $('activate-details').hidden = true;
    $('view-account-details').hidden = true;
    $('web-proxy-auto-discovery').hidden = true;
    detailsPage.showProxy = true;
    updateHidden('#internet-tab', true);
    updateHidden('#details-tab-strip', true);
    updateHidden('#details-internet-page .action-area', true);
    detailsPage.updateControls();
    detailsPage.visible = true;
    chrome.send('coreOptionsUserMetricsAction',
                ['Options_NetworkShowProxyTab']);
  };

  /**
   * Initializes even handling for keyboard driven flow.
   */
  DetailsInternetPage.initializeKeyboardFlow = function() {
    keyboard.initializeKeyboardFlow();
  };

  DetailsInternetPage.updateProxySettings = function(type) {
      var proxyHost = null,
          proxyPort = null;

      if (type == 'cros.session.proxy.singlehttp') {
        proxyHost = 'proxy-host-single-name';
        proxyPort = 'proxy-host-single-port';
      } else if (type == 'cros.session.proxy.httpurl') {
        proxyHost = 'proxy-host-name';
        proxyPort = 'proxy-host-port';
      } else if (type == 'cros.session.proxy.httpsurl') {
        proxyHost = 'secure-proxy-host-name';
        proxyPort = 'secure-proxy-port';
      } else if (type == 'cros.session.proxy.ftpurl') {
        proxyHost = 'ftp-proxy';
        proxyPort = 'ftp-proxy-port';
      } else if (type == 'cros.session.proxy.socks') {
        proxyHost = 'socks-host';
        proxyPort = 'socks-port';
      } else {
        return;
      }

      var hostValue = $(proxyHost).value;
      if (hostValue.indexOf(':') !== -1) {
        if (hostValue.match(/:/g).length == 1) {
          hostValue = hostValue.split(':');
          $(proxyHost).value = hostValue[0];
          $(proxyPort).value = hostValue[1];
        }
      }
  };

  DetailsInternetPage.updateCarrier = function() {
    DetailsInternetPage.showCarrierChangeSpinner(false);
  };

  DetailsInternetPage.loginFromDetails = function() {
    var data = $('connection-state').data;
    var servicePath = data.servicePath;
    chrome.send('networkCommand', [data.type, servicePath, 'connect']);
    PageManager.closeOverlay();
  };

  DetailsInternetPage.disconnectNetwork = function() {
    var data = $('connection-state').data;
    var servicePath = data.servicePath;
    chrome.send('networkCommand', [data.type, servicePath, 'disconnect']);
    PageManager.closeOverlay();
  };

  DetailsInternetPage.configureNetwork = function() {
    var data = $('connection-state').data;
    var servicePath = data.servicePath;
    chrome.send('networkCommand', [data.type, servicePath, 'configure']);
    PageManager.closeOverlay();
  };

  DetailsInternetPage.activateFromDetails = function() {
    var data = $('connection-state').data;
    var servicePath = data.servicePath;
    if (data.type == 'Cellular')
      chrome.send('networkCommand', [data.type, servicePath, 'activate']);
    PageManager.closeOverlay();
  };

  DetailsInternetPage.setDetails = function() {
    var data = $('connection-state').data;
    var servicePath = data.servicePath;
    if (data.type == 'WiFi') {
      sendCheckedIfEnabled(servicePath, 'setPreferNetwork',
                           $('prefer-network-wifi'));
      sendCheckedIfEnabled(servicePath, 'setAutoConnect',
                           $('auto-connect-network-wifi'));
    } else if (data.type == 'Wimax') {
      sendCheckedIfEnabled(servicePath, 'setAutoConnect',
                           $('auto-connect-network-wimax'));
    } else if (data.type == 'Cellular') {
      sendCheckedIfEnabled(servicePath, 'setAutoConnect',
                           $('auto-connect-network-cellular'));
    } else if (data.type == 'VPN') {
      chrome.send('setServerHostname',
                  [servicePath,
                   $('inet-server-hostname').value]);
      sendCheckedIfEnabled(servicePath, 'setAutoConnect',
                           $('auto-connect-network-vpn'));
    }

    var nameServerTypes = ['automatic', 'google', 'user'];
    var nameServerType = 'automatic';
    for (var i = 0; i < nameServerTypes.length; ++i) {
      if ($(nameServerTypes[i] + '-dns-radio').checked) {
        nameServerType = nameServerTypes[i];
        break;
      }
    }

    // Skip any empty values.
    var userNameServers = [];
    for (var i = 1; i <= 4; ++i) {
      var nameServerField = $('ipconfig-dns' + i);
      if (nameServerField && nameServerField.model &&
          nameServerField.model.value) {
        userNameServers.push(nameServerField.model.value);
      }
    }

    userNameServers = userNameServers.sort();
    chrome.send('setIPConfig',
                [servicePath,
                 Boolean($('ip-automatic-configuration-checkbox').checked),
                 $('ip-address').model.value || '',
                 $('ip-netmask').model.value || '',
                 $('ip-gateway').model.value || '',
                 nameServerType,
                 userNameServers.join(',')]);
    PageManager.closeOverlay();
  };

  DetailsInternetPage.updateNameServerDisplay = function(type) {
    var editable = type == 'user';
    var fields = [$('ipconfig-dns1'), $('ipconfig-dns2'),
                  $('ipconfig-dns3'), $('ipconfig-dns4')];
    for (var i = 0; i < fields.length; ++i) {
      fields[i].editable = editable;
    }
    if (editable)
      $('ipconfig-dns1').focus();

    var automaticDns = $('automatic-dns-display');
    var googleDns = $('google-dns-display');
    var userDns = $('user-dns-settings');
    switch (type) {
      case 'automatic':
        automaticDns.setAttribute('selected', '');
        googleDns.removeAttribute('selected');
        userDns.removeAttribute('selected');
        break;
      case 'google':
        automaticDns.removeAttribute('selected');
        googleDns.setAttribute('selected', '');
        userDns.removeAttribute('selected');
        break;
      case 'user':
        automaticDns.removeAttribute('selected');
        googleDns.removeAttribute('selected');
        userDns.setAttribute('selected', '');
        break;
    }
  };

  DetailsInternetPage.updateConnectionButtonVisibilty = function(onc) {
    if (onc.type == 'Ethernet') {
      // Ethernet can never be connected or disconnected and can always be
      // configured (e.g. to set security).
      $('details-internet-login').hidden = true;
      $('details-internet-disconnect').hidden = true;
      $('details-internet-configure').hidden = false;
      return;
    }

    var connectState = onc.getActiveValue('ConnectionState');
    if (connectState == 'NotConnected') {
      $('details-internet-login').hidden = false;
      // Connecting to an unconfigured network might trigger certificate
      // installation UI. Until that gets handled here, always enable the
      // Connect button.
      $('details-internet-login').disabled = false;
      $('details-internet-disconnect').hidden = true;
    } else {
      $('details-internet-login').hidden = true;
      $('details-internet-disconnect').hidden = false;
    }

    var connectable = onc.getActiveValue('Connectable');
    if (connectState != 'Connected' &&
        (!connectable || this.hasSecurity ||
        (onc.type == 'Wimax' || onc.type == 'VPN'))) {
      $('details-internet-configure').hidden = false;
    } else {
      $('details-internet-configure').hidden = true;
    }
  };

  DetailsInternetPage.populateHeader = function(detailsPage, onc) {
    $('network-details-title').textContent = onc.getTranslatedValue('Name');
    var connectionState = onc.getActiveValue('ConnectionState');
    var connectionStateString = onc.getTranslatedValue('ConnectionState');
    detailsPage.connected = connectionState == 'Connected';
    $('network-details-subtitle-status').textContent = connectionStateString;
    var typeKey;
    if (onc.type == 'Ethernet')
      typeKey = 'ethernetTitle';
    else if (onc.type == 'WiFi')
      typeKey = 'wifiTitle';
    else if (onc.type == 'Wimax')
      typeKey = 'wimaxTitle';
    else if (onc.type == 'Cellular')
      typeKey = 'cellularTitle';
    else if (onc.type == 'VPN')
      typeKey = 'vpnTitle';
    else
      typeKey = null;
    var typeLabel = $('network-details-subtitle-type');
    var typeSeparator = $('network-details-subtitle-separator');
    if (typeKey) {
      typeLabel.textContent = loadTimeData.getString(typeKey);
      typeLabel.hidden = false;
      typeSeparator.hidden = false;
    } else {
      typeLabel.hidden = true;
      typeSeparator.hidden = true;
    }
  };

  DetailsInternetPage.updateConnectionData = function(update) {
    var detailsPage = DetailsInternetPage.getInstance();
    if (!detailsPage.visible)
      return;

    var data = $('connection-state').data;
    if (!data)
      return;

    if (update.servicePath != data.servicePath)
      return;

    // Update our cached data object.
    updateDataObject(data, update);
    var onc = new OncData(data);

    this.populateHeader(detailsPage, onc);

    var connectionState = onc.getActiveValue('ConnectionState');
    var connectionStateString = onc.getTranslatedValue('ConnectionState');
    detailsPage.deviceConnected = data.deviceConnected;
    detailsPage.connected = connectionState == 'Connected';
    $('connection-state').textContent = connectionStateString;

    this.updateConnectionButtonVisibilty(onc);

    if (onc.type == 'WiFi') {
      $('wifi-connection-state').textContent = connectionStateString;
    } else if (onc.type == 'Wimax') {
      $('wimax-connection-state').textContent = connectionStateString;
    } else if (onc.type == 'Cellular') {
      $('activation-state').textContent =
          onc.getTranslatedValue('Cellular.ActivationState');
      $('buyplan-details').hidden = !data.showBuyButton;
      $('view-account-details').hidden = !data.showViewAccountButton;

      $('activate-details').hidden = !data.showActivateButton;
      if (data.showActivateButton)
        $('details-internet-login').hidden = true;

      if (detailsPage.gsm) {
        var lockEnabled =
            onc.getActiveValue('Cellular.SIMLockStatus.LockEnabled');
        $('sim-card-lock-enabled').checked = lockEnabled;
        $('change-pin').hidden = !lockEnabled;
      }
    }

    $('connection-state').data = data;
    $('connection-state').onc = onc;
  };

  DetailsInternetPage.showDetailedInfo = function(data) {
    var detailsPage = DetailsInternetPage.getInstance();

    var onc = new OncData(data);
    data.type = onc.type;

    this.populateHeader(detailsPage, onc);

    // TODO(stevenjb): Find a more appropriate place to cache data.
    $('connection-state').data = data;
    $('connection-state').onc = onc;

    $('buyplan-details').hidden = true;
    $('activate-details').hidden = true;
    $('view-account-details').hidden = true;

    this.updateConnectionButtonVisibilty(onc);

    $('web-proxy-auto-discovery').hidden = true;

    detailsPage.deviceConnected = data.deviceConnected;
    detailsPage.connected =
        onc.getActiveValue('ConnectionState') == 'Connected';

    // Only show proxy for remembered networks.
    if (data.remembered) {
      detailsPage.showProxy = true;
      chrome.send('selectNetwork', [data.servicePath]);
    } else {
      detailsPage.showProxy = false;
    }

    var connectionStateString = onc.getTranslatedValue('ConnectionState');
    $('connection-state').textContent = connectionStateString;
    var restricted = onc.getActiveValue('RestrictedConnectivity');
    var restrictedString = loadTimeData.getString(
        restricted ? 'restrictedYes' : 'restrictedNo');

    var inetAddress = {};
    var inetNetmask = {};
    var inetGateway = {};

    var inetNameServersString;

    if ('IPConfigs' in data) {
      var ipconfigList = onc.getActiveValue('IPConfigs');
      for (var i = 0; i < ipconfigList.length; ++i) {
        var ipconfig = ipconfigList[i];
        var type = ipconfig['Type'];
        if (type != 'IPv4') {
          // TODO(stevenjb): Handle IPv6 properties.
          continue;
        }
        var address = ipconfig['IPAddress'];
        inetAddress.automatic = address;
        inetAddress.value = address;
        var netmask = PrefixLengthToNetmask(ipconfig['RoutingPrefix']);
        inetNetmask.automatic = netmask;
        inetNetmask.value = netmask;
        var gateway = ipconfig['Gateway'];
        inetGateway.automatic = gateway;
        inetGateway.value = gateway;
        if ('WebProxyAutoDiscoveryUrl' in ipconfig) {
          $('web-proxy-auto-discovery').hidden = false;
          $('web-proxy-auto-discovery-url').value =
              ipconfig['WebProxyAutoDiscoveryUrl'];
        }
        if ('NameServers' in ipconfig) {
          var inetNameServers = ipconfig['NameServers'];
          inetNameServers = inetNameServers.sort();
          inetNameServersString = inetNameServers.join(',');
        }
        break;  // Use the first IPv4 entry.
      }
    }

    // Override the "automatic" values with the real saved DHCP values,
    // if they are set.
    var savedNameServersString;
    if ('SavedIPConfig' in data) {
      var savedIpAddress = onc.getActiveValue('SavedIPConfig.IPAddress');
      if (savedIpAddress != undefined) {
        inetAddress.automatic = savedIpAddress;
        inetAddress.value = savedIpAddress;
      }
      var savedPrefix = onc.getActiveValue('SavedIPConfig.RoutingPrefix');
      if (savedPrefix != undefined) {
        var savedNetmask = PrefixLengthToNetmask(savedPrefix);
        inetNetmask.automatic = savedNetmask;
        inetNetmask.value = savedNetmask;
      }
      var savedGateway = onc.getActiveValue('SavedIPConfig.Gateway');
      if (savedGateway != undefined) {
        inetGateway.automatic = savedGateway;
        inetGateway.value = savedGateway;
      }
      var savedNameServers = onc.getActiveValue('SavedIPConfig.NameServers');
      if (savedNameServers) {
        savedNameServers = savedNameServers.sort();
        savedNameServersString = savedNameServers.join(',');
      }
    }

    var ipAutoConfig = 'automatic';

    var staticNameServersString;
    if ('StaticIPConfig' in data) {
      var staticIpAddress = onc.getActiveValue('StaticIPConfig.IPAddress');
      if (staticIpAddress != undefined) {
        ipAutoConfig = 'user';
        inetAddress.user = staticIpAddress;
        inetAddress.value = staticIpAddress;
      }
      var staticPrefix = onc.getActiveValue('StaticIPConfig.RoutingPrefix');
      if (staticPrefix != undefined) {
        var staticNetmask = PrefixLengthToNetmask(staticPrefix);
        inetNetmask.user = staticNetmask;
        inetNetmask.value = staticNetmask;
      }
      var staticGateway = onc.getActiveValue('StaticIPConfig.Gateway');
      if (staticGateway != undefined) {
        inetGateway.user = staticGateway;
        inetGateway.value = staticGateway;
      }
      var staticNameServers = onc.getActiveValue('StaticIPConfig.NameServers');
      if (staticNameServers) {
        staticNameServers = staticNameServers.sort();
        staticNameServersString = staticNameServers.join(',');
      }
    }

    $('ip-automatic-configuration-checkbox').checked =
        ipAutoConfig == 'automatic';

    inetAddress.autoConfig = ipAutoConfig;
    inetNetmask.autoConfig = ipAutoConfig;
    inetGateway.autoConfig = ipAutoConfig;

    var configureAddressField = function(field, model) {
      IPAddressField.decorate(field);
      field.model = model;
      field.editable = model.autoConfig == 'user';
    };
    configureAddressField($('ip-address'), inetAddress);
    configureAddressField($('ip-netmask'), inetNetmask);
    configureAddressField($('ip-gateway'), inetGateway);

    // Set Nameserver fields.
    var nameServerType = 'automatic';
    if (staticNameServersString &&
        staticNameServersString == inetNameServersString) {
      nameServerType = 'user';
    }
    if (inetNameServersString == GoogleNameServersString)
      nameServerType = 'google';

    $('automatic-dns-display').textContent = inetNameServersString;
    $('google-dns-display').textContent = GoogleNameServersString;

    var nameServersUser = [];
    if (staticNameServers)
      nameServersUser = staticNameServers;

    var nameServerModels = [];
    for (var i = 0; i < 4; ++i)
      nameServerModels.push({value: nameServersUser[i] || ''});

    $(nameServerType + '-dns-radio').checked = true;
    configureAddressField($('ipconfig-dns1'), nameServerModels[0]);
    configureAddressField($('ipconfig-dns2'), nameServerModels[1]);
    configureAddressField($('ipconfig-dns3'), nameServerModels[2]);
    configureAddressField($('ipconfig-dns4'), nameServerModels[3]);

    DetailsInternetPage.updateNameServerDisplay(nameServerType);

    var macAddress = onc.getActiveValue('MacAddress');
    if (macAddress) {
      $('hardware-address').textContent = macAddress;
      $('hardware-address-row').style.display = 'table-row';
    } else {
      // This is most likely a device without a hardware address.
      $('hardware-address-row').style.display = 'none';
    }

    var setOrHideParent = function(field, property) {
      if (property) {
        $(field).textContent = property;
        $(field).parentElement.hidden = false;
      } else {
        $(field).parentElement.hidden = true;
      }
    };

    var networkName = onc.getTranslatedValue('Name');

    // Signal strength as percentage (for WiFi and Wimax).
    var signalStrength;
    if (onc.type == 'WiFi' || onc.type == 'Wimax') {
      signalStrength = onc.getActiveValue(onc.type + '.SignalStrength');
    }
    if (!signalStrength)
      signalStrength = 0;
    var strengthFormat = loadTimeData.getString('inetSignalStrengthFormat');
    var strengthString = strengthFormat.replace('$1', signalStrength);

    detailsPage.type = onc.type;
    if (onc.type == 'WiFi') {
      OptionsPage.showTab($('wifi-network-nav-tab'));
      detailsPage.gsm = false;
      detailsPage.shared = data.shared;
      $('wifi-connection-state').textContent = connectionStateString;
      $('wifi-restricted-connectivity').textContent = restrictedString;
      var ssid = onc.getActiveValue('WiFi.SSID');
      $('wifi-ssid').textContent = ssid ? ssid : networkName;
      setOrHideParent('wifi-bssid', onc.getActiveValue('WiFi.BSSID'));
      var security = onc.getActiveValue('WiFi.Security');
      if (security == 'None')
        security = undefined;
      setOrHideParent('wifi-security', security);
      // Frequency is in MHz.
      var frequency = onc.getActiveValue('WiFi.Frequency');
      if (!frequency)
        frequency = 0;
      var frequencyFormat = loadTimeData.getString('inetFrequencyFormat');
      frequencyFormat = frequencyFormat.replace('$1', frequency);
      $('wifi-frequency').textContent = frequencyFormat;
      $('wifi-signal-strength').textContent = strengthString;
      setOrHideParent('wifi-hardware-address',
                      onc.getActiveValue('MacAddress'));
      detailsPage.showPreferred = data.remembered;
      var priority = onc.getActiveValue('Priority');
      $('prefer-network-wifi').checked = priority > 0;
      $('prefer-network-wifi').disabled = !data.remembered;
      $('auto-connect-network-wifi').checked =
          onc.getActiveValue('AutoConnect');
      $('auto-connect-network-wifi').disabled = !data.remembered;
      detailsPage.hasSecurity = security != undefined;
    } else if (onc.type == 'Wimax') {
      OptionsPage.showTab($('wimax-network-nav-tab'));
      detailsPage.gsm = false;
      detailsPage.shared = data.shared;
      detailsPage.showPreferred = data.remembered;
      $('wimax-connection-state').textContent = connectionStateString;
      $('wimax-restricted-connectivity').textContent = restrictedString;
      $('auto-connect-network-wimax').checked =
          onc.getActiveValue('AutoConnect');
      $('auto-connect-network-wimax').disabled = !data.remembered;
      var identity = onc.getActiveValue('Wimax.EAP.Identity');
      setOrHideParent('wimax-eap-identity', identity);
      $('wimax-signal-strength').textContent = strengthString;
    } else if (onc.type == 'Cellular') {
      OptionsPage.showTab($('cellular-conn-nav-tab'));
      if (data.showCarrierSelect && data.currentCarrierIndex != -1) {
        var carrierSelector = $('select-carrier');
        carrierSelector.onchange = DetailsInternetPage.handleCarrierChanged;
        carrierSelector.options.length = 0;
        for (var i = 0; i < data.carriers.length; ++i) {
          var option = document.createElement('option');
          option.textContent = data.carriers[i];
          carrierSelector.add(option);
        }
        carrierSelector.selectedIndex = data.currentCarrierIndex;
      } else {
        $('service-name').textContent = networkName;
      }

      $('network-technology').textContent =
          onc.getActiveValue('Cellular.NetworkTechnology');
      $('activation-state').textContent =
          onc.getTranslatedValue('Cellular.ActivationState');
      $('roaming-state').textContent =
          onc.getTranslatedValue('Cellular.RoamingState');
      $('cellular-restricted-connectivity').textContent = restrictedString;
      $('error-state').textContent = data.errorMessage;
      $('manufacturer').textContent =
          onc.getActiveValue('Cellular.Manufacturer');
      $('model-id').textContent = onc.getActiveValue('Cellular.ModelID');
      $('firmware-revision').textContent =
          onc.getActiveValue('Cellular.FirmwareRevision');
      $('hardware-revision').textContent =
          onc.getActiveValue('Cellular.HardwareRevision');
      $('mdn').textContent = onc.getActiveValue('Cellular.MDN');

      // Show ServingOperator properties only if available.
      var servingOperatorName =
          onc.getActiveValue('Cellular.ServingOperator.Name');
      var servingOperatorCode =
          onc.getActiveValue('Cellular.ServingOperator.Code');
      if (servingOperatorName != undefined &&
          servingOperatorCode != undefined) {
        $('operator-name').textContent = servingOperatorName;
        $('operator-code').textContent = servingOperatorCode;
      } else {
        $('operator-name').parentElement.hidden = true;
        $('operator-code').parentElement.hidden = true;
      }
      // Make sure that GSM/CDMA specific properties that shouldn't be hidden
      // are visible.
      updateHidden('#details-internet-page .gsm-only', false);
      updateHidden('#details-internet-page .cdma-only', false);

      // Show IMEI/ESN/MEID/MIN/PRL only if they are available.
      setOrHideParent('esn', onc.getActiveValue('Cellular.ESN'));
      setOrHideParent('imei', onc.getActiveValue('Cellular.IMEI'));
      setOrHideParent('meid', onc.getActiveValue('Cellular.MEID'));
      setOrHideParent('min', onc.getActiveValue('Cellular.MIN'));
      setOrHideParent('prl-version', onc.getActiveValue('Cellular.PRLVersion'));

      var family = onc.getActiveValue('Cellular.Family');
      detailsPage.gsm = family == 'GSM';
      if (detailsPage.gsm) {
        $('iccid').textContent = onc.getActiveValue('Cellular.ICCID');
        $('imsi').textContent = onc.getActiveValue('Cellular.IMSI');

        var apnSelector = $('select-apn');
        // Clear APN lists, keep only last element that "other".
        while (apnSelector.length != 1)
          apnSelector.remove(0);
        var otherOption = apnSelector[0];
        data.selectedApn = -1;
        data.userApnIndex = -1;
        var activeApn = onc.getActiveValue('Cellular.APN.AccessPointName');
        var activeUsername = onc.getActiveValue('Cellular.APN.Username');
        var activePassword = onc.getActiveValue('Cellular.APN.Password');
        var lastGoodApn =
            onc.getActiveValue('Cellular.LastGoodAPN.AccessPointName');
        var lastGoodUsername =
            onc.getActiveValue('Cellular.LastGoodAPN.Username');
        var lastGoodPassword =
            onc.getActiveValue('Cellular.LastGoodAPN.Password');
        var apnList = onc.getActiveValue('Cellular.APNList');
        for (var i = 0; i < apnList.length; i++) {
          var apnDict = apnList[i];
          var option = document.createElement('option');
          var localizedName = apnDict['LocalizedName'];
          var name = localizedName ? localizedName : apnDict['Name'];
          var accessPointName = apnDict['AccessPointName'];
          option.textContent =
              name ? (name + ' (' + accessPointName + ')') : accessPointName;
          option.value = i;
          // If this matches the active Apn, or LastGoodApn, set it as the
          // selected Apn.
          if ((activeApn == accessPointName &&
               activeUsername == apnDict['Username'] &&
               activePassword == apnDict['Password']) ||
              (!activeApn &&
               lastGoodApn == accessPointName &&
               lastGoodUsername == apnDict['Username'] &&
               lastGoodPassword == apnDict['Password'])) {
            data.selectedApn = i;
          }
          // Insert new option before "other" option.
          apnSelector.add(option, otherOption);
        }
        if (data.selectedApn == -1 && activeApn) {
          var option = document.createElement('option');
          option.textContent = activeApn;
          option.value = -1;
          apnSelector.add(option, otherOption);
          data.selectedApn = apnSelector.length - 2;
          data.userApnIndex = data.selectedApn;
        }
        apnSelector.selectedIndex = data.selectedApn;
        updateHidden('.apn-list-view', false);
        updateHidden('.apn-details-view', true);
        var lockEnabled =
            onc.getActiveValue('Cellular.SIMLockStatus.LockEnabled');
        $('sim-card-lock-enabled').checked = lockEnabled;
        $('change-pin').hidden = !lockEnabled;
      }
      $('auto-connect-network-cellular').checked =
          onc.getActiveValue('AutoConnect');
      $('auto-connect-network-cellular').disabled = false;

      $('buyplan-details').hidden = !data.showBuyButton;
      $('view-account-details').hidden = !data.showViewAccountButton;
      $('activate-details').hidden = !data.showActivateButton;
      if (data.showActivateButton) {
        $('details-internet-login').hidden = true;
      }
    } else if (onc.type == 'VPN') {
      OptionsPage.showTab($('vpn-nav-tab'));
      detailsPage.gsm = false;
      $('inet-service-name').textContent = networkName;
      $('inet-provider-type').textContent =
          onc.getTranslatedValue('VPN.Type');
      var providerType = onc.getActiveValue('VPN.Type');
      var providerKey = 'VPN.' + providerType;
      $('inet-username').textContent =
          onc.getActiveValue(providerKey + '.Username');
      var inetServerHostname = $('inet-server-hostname');
      inetServerHostname.value = onc.getActiveValue('VPN.Host');
      inetServerHostname.resetHandler = function() {
        PageManager.hideBubble();
        var recommended = onc.getRecommendedValue('VPN.Host');
        if (recommended != undefined)
          inetServerHostname.value = recommended;
      };
      $('auto-connect-network-vpn').checked =
          onc.getActiveValue('AutoConnect');
      $('auto-connect-network-vpn').disabled = false;
    } else {
      OptionsPage.showTab($('internet-nav-tab'));
    }

    // Update controlled option indicators.
    var indicators = cr.doc.querySelectorAll(
        '#details-internet-page .controlled-setting-indicator');
    for (var i = 0; i < indicators.length; i++) {
      var managed = indicators[i].hasAttribute('managed');
      var attributeName = managed ? 'managed' : 'data';
      var propName = indicators[i].getAttribute(attributeName);
      if (!propName)
        continue;
      var propValue = managed ?
          onc.getManagedProperty(propName) :
          onc.getActiveValue(propName);
      if (propValue == undefined)
        continue;
      var event;
      if (managed)
        event = detailsPage.createManagedEvent_(propName, propValue);
      else
        event = detailsPage.createControlledEvent_(propName, propValue);
      indicators[i].handlePrefChange(event);
      var forElement = $(indicators[i].getAttribute('for'));
      if (forElement) {
        if (event.value.controlledBy == 'policy')
          forElement.disabled = true;
        if (forElement.resetHandler)
          indicators[i].resetHandler = forElement.resetHandler;
      }
    }

    detailsPage.updateControls();

    // Don't show page name in address bar and in history to prevent people
    // navigate here by hand and solve issue with page session restore.
    PageManager.showPageByName('detailsInternetPage', false);
  };

  return {
    DetailsInternetPage: DetailsInternetPage
  };
});
