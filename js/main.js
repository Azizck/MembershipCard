document.getElementById("submit-btn").addEventListener("click",create);
let name = document.getElementById("name");
let id = document.getElementById("id");
let year = document.getElementById("year");

//document.getElementById("download").addEventListener("click",screenshot);


function screenshot() {
        var node = document.getElementById("card-container");
        var nodeContainer = document.getElementsByTagName("main")[0]
        domtoimage.toPng(node)
          .then(function(img) {
            nodeContainer.appendChild(img);
            document.getElementById("card-container").remove(node.childNodes[3]);
 
          });

            } ;


 function create(event){
  
  //prevent the button form submitting the form to server 
  event.preventDefault();
  // scroll down
//retrieve the input from the form 
 let form =  document.forms[0];  
 let givenName= form[0].value;
 let givenId = form[1].value;
 let givenYear = form[2].value;




  let validateFile = document.getElementById("files").files;

 if(givenName.length  < 1  || givenId < 100 || givenYear < 100 || validateFile.length < 1 ){
  alert("Pleasae Enter the inforamtion");
 }else{
 name.innerHTML = givenName;
 id.innerHTML= givenId;
 year.innerHTML= givenYear;
JsBarcode("#barcode", givenId);


 // for debugging;
 console.log(`name is ${givenName}, Id is ${givenId}, year is ${givenYear}`);
let img = document.getElementById("files").files[0];
  displayImage(img);
document.getElementsByClassName('form')[0].remove();
//window.scrollBy(0, 665); 
setTimeout(screenshot, 1000);
}



function displayImage(img){
    var f =img; 
    var reader = new FileReader();
    img = document.getElementById('img');
    reader.onload = function(e) {
        img.src = e.target.result;
    }
    reader.readAsDataURL(f);
  }
}
JsBarcode("#barcode", "999999999");
