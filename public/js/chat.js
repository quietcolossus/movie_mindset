var one = document.getElementById("one");
var two = document.getElementById("two");
var three = document.getElementById("three");
var four = document.getElementById("four");
var five = document.getElementById("five");
var nosee = document.getElementById("nosee");

one.onclick = function() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/main", true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send("value=1");
  location.reload();
}

two.onclick = function() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/main", true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send("value=2");
  location.reload();
}

three.onclick = function() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/main", true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send("value=3");
  location.reload();
}

four.onclick = function() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/main", true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send("value=4");
  location.reload();
}

five.onclick = function() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/main", true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send("value=5");
  location.reload();
}

nosee.onclick = function() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/main", true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send("value=0");
  location.reload();
}