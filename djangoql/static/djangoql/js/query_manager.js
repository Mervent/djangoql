/*jslint browser: true*/
var DjangoQM = (function() {
  'use strict';

  var $ = jQuery || django.jQuery;
  return {
    toolboxTemplate: '' +
      '<div class="djangoql-qm-buttons">' +
        '<span class="djangoql-qm-star noselect" title="Save query">★</span>' +
        '<span class="djangoql-qm-toggle noselect" title="Toggle interface">▾</span>' +
      '</div>' +
      '<div id="djangoql-qm-container">' +
        '<div id="djangoql-qm-content">' +
          '<input id="djangoql-qm-search" type="text" placeholder="Search">' +
          '<hr>' +
          'Saved Queries' +
          '<div id="djangoql-qm-results-wrapper">' +
            '<div id="djangoql-qm-results">' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>',
    userQueryTemplate: '' +
      '<div class="djangoql-qm-query" data-id="__id__">' +
        '<div class="djangoql-qm-text">__text__</div>' +
        '<div class="djangoql-qm-query-control">' +
            '<span class="djangoql-qm-share noselect __public__" title="Toggle public query">⚑</span>' +
            '<span class="djangoql-qm-delete noselect" title="Delete query"> ✘</span>' +
        '</div>' +
      '</div>',
    publicQueryTemplate: '' +
      '<div class="djangoql-qm-query" data-id="__id__">' +
          '<div class="djangoql-qm-text">__text__</div>' +
          '<div class="djangoql-qm-public-tooltip">' +
            'Shared by other user' +
          '</div>' +
      '</div>',

    init: function (settings) {
      var inputSelector = settings.inputSelector || '#searchbar';
      this.getCsrfMiddlewareToken =
        settings.getCsrfMiddlewareToken || this.getCsrfMiddlewareToken;
      this.baseUrl = settings.baseUrl || '';

      $(inputSelector).after(this.toolboxTemplate);
      this.bindComponents(inputSelector);
      this.registerEventHandlers();
      this.refreshQueryList();
    },

    bindComponents: function (inputSelector) {
      this.inputSelector = inputSelector;

      this.starButton = $('.djangoql-qm-star');
      this.toggleButton = $('.djangoql-qm-toggle');
      this.searchBox = $('#djangoql-qm-search');
      this.popupWindow = $('#djangoql-qm-content');
      this.resultsContainer = $('#djangoql-qm-results');
    },

    registerEventHandlers: function () {
      var self = this;
      var checkStarTimeout;
      var searchTimeout;
      var querySelector = '.djangoql-qm-query';

      self.starButton.on('click', function () {
        if (self.currentQueryId) {
          self.removeQuery(self.currentQueryId);
        } else {
          var query = $(self.inputSelector).val();
          self.saveQuery(query);
        }
      });

      $(document).on('input propertychanged', self.inputSelector, function () {
        window.clearTimeout(checkStarTimeout);
        checkStarTimeout = window.setTimeout(function () {
          self.updateStarIconStatus();
        }, 250);
      });

      this.toggleButton.on('click', function () {
        self.popupWindow.toggle();
      });

      self.searchBox.on('input propertychanged', function () {
        window.clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(function () {
          var results = self.filterQueryList(self.searchBox.val());
          self.renderResults(results);
        }, 500);
      });

      self.searchBox.on('keydown', function (e) {
        if (e.keyCode === 13) {
          e.preventDefault(); // prevent form submit on Enter
          var results = self.filterQueryList(self.searchBox.val());
          self.renderResults(results);
        }
      });

      $(document).on('click', '.djangoql-qm-text', function () {
        var queryText = $(this).text();
        $(self.inputSelector).val(queryText);
        self.updateStarIconStatus();
        self.popupWindow.hide();
      });

      $(document).on('click', '.djangoql-qm-delete', function () {
        var query_id = $(this).closest(querySelector).data('id');
        self.removeQuery(query_id);
      });

      $(document).on('click', '.djangoql-qm-share', function () {
        var query_id = $(this).closest(querySelector).data('id');
        var state = !$(this).hasClass('public');
        self.togglePublicState(query_id, state);
      });
    },

    getCsrfMiddlewareToken: function () {
      return $("[name=csrfmiddlewaretoken]").val();
    },

    cacheResults: function (results) {
      this.publicQueryList = results.public;
      this.userQueryList = results.user;
    },

    filterQueryList: function (contains) {
      return {
        'user': this.userQueryList.filter(function (obj) {
          return (obj.text.indexOf(contains) !== -1);
        }),
        'public': this.publicQueryList.filter(function (obj) {
          return (obj.text.indexOf(contains) !== -1);
        })
      };
    },

    getUserQuery: function (queryText) {
      return this.userQueryList.filter(function (obj) {
        return obj.text === queryText;
      })[0];
    },

    updateStarIconStatus: function () {
      var currentQueryText = $(this.inputSelector).val();
      var userQuery = this.getUserQuery(currentQueryText);

      if (userQuery) {
        this.starButton.addClass('starred');
        this.currentQueryId = userQuery.id;
      } else {
        this.starButton.removeClass('starred');
        this.currentQueryId = null;
      }
    },

    renderResults: function (results) {
      var self = this;
      self.resultsContainer.empty();
      $.each(results.user, function (key, val) {
        var elem = $(self.renderQuery(self.userQueryTemplate, val));
        self.resultsContainer.append(elem);
      });

      $.each(results.public, function (key, val) {
        var elem = $(self.renderQuery(self.publicQueryTemplate, val));
        self.resultsContainer.append(elem);
      });
    },

    renderQuery: function (template, query) {
      return template
        .replace(/__id__/g, query.id)
        .replace(/__text__/g, query.text)
        .replace(/__public__/g, query.public ? 'public' : '');
    },

    saveQuery: function (query) {
      var self = this;
      if (!query) { return; }
      $.post(self.baseUrl + 'save-query/', {
        query: query,
        csrfmiddlewaretoken: this.getCsrfMiddlewareToken()
      }).done(function () {
        self.refreshQueryList();
      });
    },

    refreshQueryList: function () {
      var self = this;
      $.getJSON(self.baseUrl + 'get-queries/')
        .done(function (json) {
            self.cacheResults(json.results);
            self.renderResults(json.results);
            self.updateStarIconStatus();
          }
        );
    },

    togglePublicState: function (query_id, state) {
      this.updateQuery(query_id, { 'public': state });
    },

    updateQuery: function (query_id, data) {
      var self = this;
      data = data || {};
      data.id = query_id;
      data.csrfmiddlewaretoken = this.getCsrfMiddlewareToken();
      $.post(self.baseUrl + 'update-query/', data).done(function () {
        self.refreshQueryList();
      });
    },

    removeQuery: function (query_id) {
      var self = this;
      var data = {
        id: query_id,
        csrfmiddlewaretoken: this.getCsrfMiddlewareToken()
      };
      $.post(self.baseUrl + 'remove-query/', data).done(function () {
        $('.djangoql-qm-query[data-id=' + query_id + ']', self.resultsContainer).fadeOut(
          200, function () {
            self.refreshQueryList();
          }
        );
      });
    }
  };
}());