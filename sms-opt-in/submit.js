(function () {
  var form = document.getElementById("opt-in-form");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = (document.getElementById("name") || {}).value || "";
    var phone = (document.getElementById("phone") || {}).value || "";
    var email = (document.getElementById("email") || {}).value || "";
    var consent = (document.getElementById("consent") || {}).checked ? "Yes" : "No";
    var subject = "Winston SMS opt-in request";
    var lines = [
      "I would like to opt in to Corgi Capital Winston SMS alerts.",
      "",
      "Name: " + name,
      "Phone: " + phone,
      "Email: " + email,
      "Consent: " + consent,
      "",
      "I have read and agree to the SMS Terms (https://corgi-capital.com/terms)",
      "and Privacy Policy (https://corgi-capital.com/privacy).",
      "",
      "I understand message and data rates may apply, and I can reply STOP",
      "to unsubscribe at any time."
    ];
    var body = lines.join("\n");
    var href =
      "mailto:bill@corgi-capital.com" +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    window.location.href = href;
  });
})();
