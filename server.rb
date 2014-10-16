
require 'sinatra'
require 'base64'
require 'json'

BUCKET = 'videos-adman-public-dev'
AWS_KEY_ID = 'AKIAJSXLL3KEOHVSFG7A'
AWS_SECRET_KEY = '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'

get '/' do
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
