(function () {
  // Live Filter & Search Logic
  var q = document.getElementById("q"), evf = document.getElementById("evf");
  var rows = document.querySelectorAll("#regTable tbody tr");

  function apply() {
    var t = q ? q.value.trim().toLowerCase() : "", e = evf ? evf.value : "";
    rows.forEach(function (r) {
      var ok = (!t || r.dataset.text.indexOf(t) > -1) && (!e || r.dataset.event === e);
      r.hidden = !ok;
    });
  }

  if (q) q.addEventListener("input", apply);
  if (evf) evf.addEventListener("change", apply);

  // Toast Notification Helper
  function showToast(msg, isError) {
    var toast = document.createElement("div");
    toast.className = "admin-toast " + (isError ? "err" : "ok");
    toast.textContent = msg;
    toast.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 12px 20px; border-radius: 6px; font-weight: 600; color: #fff; background: " + (isError ? "#F87171" : "#34D399") + "; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.3s ease;";
    if (!isError) toast.style.color = "#14213D";
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = "0";
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // Intercept Form Submissions via AJAX
  document.addEventListener("submit", function (e) {
    var form = e.target;

    // Skip logout form
    if (form.action && form.action.indexOf("/admin/logout") > -1) return;

    e.preventDefault();

    var formData = new FormData(form);

    fetch(form.action, {
      method: "POST",
      body: formData,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json"
      }
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          showToast(data.message || "Action completed", false);

          // Handle Row Deletions
          if (form.action.indexOf("/delete") > -1) {
            var tr = form.closest("tr");
            if (tr) {
              tr.style.transition = "opacity 0.3s ease";
              tr.style.opacity = "0";
              setTimeout(function () { tr.remove(); }, 300);
            }
          }
          // Handle Registration Confirm/Accept
          else if (form.action.indexOf("/reg/confirm") > -1) {
            var actionCell = form.closest("td");
            if (actionCell) {
              actionCell.innerHTML = '<span style="color: var(--admin-ok); font-weight: 700; font-size: 13px;">CONFIRMED</span>';
            }
          }
          // Handle Registration Reject
          else if (form.action.indexOf("/reg/reject") > -1) {
            var actionCell = form.closest("td");
            if (actionCell) {
              actionCell.innerHTML = '<span style="color: var(--admin-err); font-weight: 700; font-size: 13px;">REJECTED</span>';
            }
          }
          // Handle Event Add/Edit
          else if (form.action.indexOf("/event/add") > -1 || form.action.indexOf("/event/edit") > -1) {
            setTimeout(function () { window.location.reload(); }, 600);
          }
        } else {
          showToast(data.error || "Action failed", true);
        }
      })
      .catch(function () {
        showToast("Network error. Please try again.", true);
      });
  });
})();