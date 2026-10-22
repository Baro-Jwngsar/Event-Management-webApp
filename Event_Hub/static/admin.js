(function () {
  var q = document.getElementById("q"), evf = document.getElementById("evf");
  var rows = document.querySelectorAll("#regTable tbody tr");
  function apply() {
    var t = q.value.trim().toLowerCase(), e = evf.value;
    rows.forEach(function (r) {
      var ok = (!t || r.dataset.text.indexOf(t) > -1) && (!e || r.dataset.event === e);
      r.hidden = !ok;
    });
  }
  q.addEventListener("input", apply);
  evf.addEventListener("change", apply);
})();
