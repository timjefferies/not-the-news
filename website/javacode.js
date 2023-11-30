$(window).on('load', function() {
  const store = localStorage || window.localStorage;
  let hiddenIds = store.getItem("hidden") ? store.getItem("hidden").split(",") : [];

  $(".item .close").on("click", function(e) {
    let component = $(e.target).parent().attr("id");
    if (!hiddenIds.includes(component)) {
      hiddenIds.push(component);
      store.setItem("hidden", hiddenIds.join(","));
    }
    $("#" + component).hide();
  });

  // Restore user scroll location on reload
  var scrollpos = store.getItem('scrollpos');
  if (scrollpos) {
    setTimeout(function() {
      window.scrollTo(0, scrollpos);
    }, 0);
  }

  window.onbeforeunload = function() {
    store.setItem('scrollpos', window.scrollY);
  };

  hiddenIds.forEach(function(id) {
    $("#" + id).hide();
  });

  // Hide the loading screen
  $("#loading-screen").hide();

  // Add scroll-to-top button functionality
  $("#scroll-to-top-button").on("click", function() {
    $("html, body").animate({ scrollTop: 0 }, "slow");
  });
});

