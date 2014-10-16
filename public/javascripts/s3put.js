/*
#  Client Side S3 CORS Upload for Amazon S3

Roughly based on https://github.com/tadruj/s3upload-coffee-javascript

## CORS config needed on S3 side:

```
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <CORSRule>
        <AllowedOrigin>*</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <AllowedHeader>Authorization</AllowedHeader>
    </CORSRule>
    <CORSRule>
        <AllowedOrigin>*</AllowedOrigin>
        <AllowedMethod>PUT</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
```

## HTML on client:

```
<input id="s3put_input" type='file' name='files[]' onchange="upload_file();" />
<div id="progress"></div>
```

## JS on client:

```
function upload_file() {
  S3Put.start({
    input_id: 's3put_input',
    s3_sign_url: '/upload/sign',
    s3_key: 'original',
    onProgress: function(percent, status) { // Use this for live upload progress bars
      document.getElementById('progress').textContent = percent + "% " + status;
    },
    onFinish: function(public_url) { // Get the URL of the uploaded file
      document.getElementById('progress').textContent = "100% Done";
    },
    onError: function(status) {
      document.getElementById('progress').textContent = "Error: " + status;
    }
  });
}
```

## Ruby on server:

```
BUCKET = 'blah'
AWS_KEY_ID = 'blah'
AWS_SECRET_KEY = 'blah+FZDW+blah'

get '/upload' do
  erb :'form'
end

get '/upload/sign' do
  objectName = params[:s3_key]
  mimeType = params['s3_object_type']
  expires = Time.now.to_i + 100 # PUT request to S3 must start within 100 seconds

  amzHeaders = "x-amz-acl:public-read" # set the public read permission on the uploaded file
  stringToSign = "PUT\n\n#{mimeType}\n#{expires}\n#{amzHeaders}\n/#{BUCKET}/#{objectName}";
  sig = CGI::escape(Base64.strict_encode64(OpenSSL::HMAC.digest('sha1', AWS_SECRET_KEY, stringToSign)))

  content_type :json
  {
    signed_request: CGI::escape("http://#{BUCKET}.s3.amazonaws.com/#{objectName}?AWSAccessKeyId=#{AWS_KEY_ID}&Expires=#{expires}&Signature=#{sig}"),
    url: "http://#{BUCKET}.s3.amazonaws.com/#{objectName}"
  }.to_json
end
```

*/

(function() {

  // Create a safe reference to the object
  var S3Put = function(obj) {
    if (obj instanceof S3Put) return obj;
    if (!(this instanceof S3Put)) return new S3Put(obj);
    this._wrapped = obj;
  };

  // Global access for the browser
  window.S3Put = S3Put;

  S3Put.s3_key = 'original';

  S3Put.s3_sign_url = '/upload/sign';

  S3Put.input_id = 's3put_input';

  S3Put.onFinish = function(public_url) {
    console.log('base.onFinish()', public_url);
  };

  S3Put.onProgress = function(percent, status) {
    console.log('base.onProgress()', percent, status);
  };

  S3Put.onError = function(status) {
    console.log('base.onError()', status);
  };

  S3Put.start = function(options) {
    if (options == null) options = {};
    for (option in options) {
      this[option] = options[option];
    }
    this.handleFileSelect(document.getElementById(this.input_id));
  }

  S3Put.handleFileSelect = function(file_element) {
    var f, files, output, _i, _len, _results;
    this.onProgress(0, 'Upload started.');
    files = file_element.files;
    output = [];
    for (_i = 0, _len = files.length; _i < _len; _i++) {
      f = files[_i];
      this.uploadFile(f);
    }
  };

  S3Put.createCORSRequest = function(method, url) {
    var xhr = S3Put.getXHR();
    if (xhr.withCredentials != null) {
      xhr.open(method, url, true);
    } else if (typeof XDomainRequest !== "undefined") {
      xhr.open(method, url);
    } else {
      xhr = null;
    }
    return xhr;
  };

  S3Put.executeOnSignedUrl = function(file, callback) {
    var xhr = S3Put.getXHR();
    xhr.open('GET', this.s3_sign_url + '?s3_object_type=' + file.type + '&s3_key=' + this.s3_key, true);
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.onreadystatechange = function(e) {
      var result;
      if (this.readyState === 4 && this.status === 200) {
        try {
          result = JSON.parse(this.responseText);
        } catch (error) {
          S3Put.onError('Signing server returned some ugly/empty JSON: "' + this.responseText + '"');
        }
        callback(decodeURIComponent(result.signed_request), result.url);
      } else if (this.readyState === 4 && this.status !== 200) {
        S3Put.onError('Could not contact request signing server. Status = ' + this.status);
      }
    };
    xhr.send();
  };

  S3Put.uploadToS3 = function(file, url, public_url) {
    var xhr = this.createCORSRequest('PUT', url);
    if (!xhr) {
      this.onError('CORS not supported');
    } else {
      xhr.onload = function() {
        if (xhr.status === 200) {
          S3Put.onProgress(100, 'Upload completed.');
          S3Put.onFinish(public_url);
        } else {
          S3Put.onError('Upload error: ' + xhr.status);
        }
      };
      xhr.onerror = function() {
        S3Put.onError('XHR error.');
      };
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          var perc = Math.round((e.loaded / e.total) * 100);
          S3Put.onProgress(perc, perc === 100 ? 'Finalizing.' : 'Uploading.');
        }
      };
    }
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-amz-acl', 'public-read');
    xhr.send(file);
  };

  S3Put.uploadFile = function(file) {
    this.executeOnSignedUrl(file, function(signedURL, publicURL) {
      S3Put.uploadToS3(file, signedURL, publicURL);
    });
  };

  S3Put.getXHR = function(){
    var xhr;
    try { xhr = new XDomainRequest(); }  //Exploter del futuro y basurilla similar
    catch (e) {
      try { xhr = new ActiveXObject('Msxml2.XMLHTTP'); }  //Exploter y basurilla similar
      catch (e) {
        try { xhr = new ActiveXObject('Microsoft.XMLHTTP'); }  //Más Exploter
        catch (e2) {
          try { xhr = new XMLHttpRequest(); } //un NAVEGADOR (con mayúsculas)
          catch (e3) {  xhr = false;   }
        }
      }
    }
    return xhr;
  };


}).call(this);
