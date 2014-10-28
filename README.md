#  Client Side S3 CORS Upload for Amazon S3

Working example!

Run `bundle` and then `ruby server.rb`. You have Sinatra singing now on your
localhost.

Roughly based on https://github.com/tadruj/s3upload-coffee-javascript

Tested on production on Chrome and Firefox.

## Use

Just put `s3put.js` into your statics folder, configure your S3 bucket for CORS,
and make it dance for you by using this example as your guide.

## CORS config needed on S3 side:

```xml
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

```html
    <input id="s3put_input" type='file' name='files[]' onchange="upload_file();" />
    <div id="progress"></div>
```

## JS on client:

```javascript
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

```ruby
    BUCKET = 'blah'
    AWS_KEY_ID = 'blah'
    AWS_SECRET_KEY = 'blah+FZDW+blah'

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
