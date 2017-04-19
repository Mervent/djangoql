/*jslint browser: true*/
(function($) {
  $(document).ready(function () {

    var qManager = {
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
              '<table id="djangoql-qm-results">' +
              '</table>' +
            '</div>' +
          '</div>' +
        '</div>',
      resultsTemplate: '' +
        '<tr data-id="__id__" data-text="__text__">' +
          '<td class="djangoql-qm-insert">__text__</td>' +
          '<td class="djangoql-qm-delete">' +
            '<span title="Delete query">✘</span>' +
          '</td>' +
        '</tr>',

      init: function(inputSelector) {
        $(inputSelector).after(this.toolboxTemplate);
        this.bindComponents(inputSelector);
        this.registerEventHandlers();
        this.refreshQueryList();
      },

      bindComponents : function(inputSelector) {
        this.inputSelector = inputSelector;

        this.starButton = $('.djangoql-qm-star');
        this.toggleButton = $('.djangoql-qm-toggle');
        this.searchBox = $('#djangoql-qm-search');
        this.popupWindow = $('#djangoql-qm-content');
        this.resultsContainer = $('#djangoql-qm-results');
      },

      registerEventHandlers : function() {
        var self = this;
        var checkStarTimeout;
        var searchTimeout;

        self.starButton.on('click', function() {
          if (self.currentQueryId) {
            self.removeQuery(self.currentQueryId);
          } else {
            var query = $(self.inputSelector).val();
            self.saveQuery(query);
          }
        });

        $(document).on('input propertychanged', self.inputSelector, function () {
          window.clearTimeout(checkStarTimeout);
          checkStarTimeout = window.setTimeout(function() {
            self.updateStarIconStatus();
          }, 250);
        });

        this.toggleButton.on('click', function () {
          self.popupWindow.toggle();
        });

        self.searchBox.on('input propertychanged', function () {
          window.clearTimeout(searchTimeout);
          searchTimeout = window.setTimeout(function() {
            var results = self.filterQuery(self.searchBox.val());
            self.renderResults(results);
          }, 500);
        });

        self.searchBox.on('keydown', function(e) {
          if(e.keyCode === 13) {
            e.preventDefault(); // prevent form submit on Enter
            var results = self.filterQuery(self.searchBox.val());
            self.renderResults(results);
          }
        });

        $(document).on('click', '.djangoql-qm-insert', function () {
          $(self.inputSelector).val(
            $(this).text()
          );
          self.updateStarIconStatus();
          self.popupWindow.hide();
        });

        $(document).on('click', '.djangoql-qm-delete', function () {
          var query_id = $(this).parent('tr').data('id');
          self.removeQuery(query_id);
        });
      },

      getCsrfMiddlewareToken: function() {
        return $("[name=csrfmiddlewaretoken]").val();
      },

      cacheResults: function(results) {
        this.userQueryList = results;
      },

      filterQuery : function(contains) {
        return this.userQueryList.filter(function(obj) {
          return (obj.text.indexOf(contains) !== -1);
        });
      },

      getQuery : function(queryText) {
        return this.userQueryList.filter(function(obj) {
          return obj.text === queryText;
        })[0];
      },

      updateStarIconStatus: function() {
        var currentQueryText = $(this.inputSelector).val();
        var userQuery = this.getQuery(currentQueryText);

        if (userQuery) {
          this.starButton.addClass('starred');
          this.currentQueryId = userQuery.id;
        } else {
          this.starButton.removeClass('starred');
          this.currentQueryId = null;
        }
      },

      renderResults: function(results) {
        var self = this;
        self.resultsContainer.empty();
        $.each(results, function(key, val){
          var elem = $(
            self.resultsTemplate
              .replace(/__id__/g, val.id)
              .replace(/__text__/g, val.text)
          );
          self.resultsContainer.append(elem);
        });
      },

      saveQuery: function (query) {
        var self = this;
        if (!query) { return; }
        $.post("save-query/", {
          query: query,
          csrfmiddlewaretoken: this.getCsrfMiddlewareToken()
        }).done(function() {
          self.refreshQueryList();
        });
      },

      refreshQueryList: function() {
        var self = this;
        $.getJSON('get-queries/')
          .done(function(json) {
              self.cacheResults(json.results);
              self.renderResults(json.results);
              self.updateStarIconStatus();
            }
          );
      },

      removeQuery: function(query_id) {
        var self = this;
        $.post("remove-query/", {
          id: query_id,
          csrfmiddlewaretoken: this.getCsrfMiddlewareToken()
        }).done(function() {
            $('tr[data-id=' + query_id + ']', self.resultsContainer).fadeOut(
              200, function() {
                self.refreshQueryList();
              }
            );
        });
      }
    };

    qManager.init('#searchbar');
  });
})(django.jQuery);