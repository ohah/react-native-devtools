#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <SocketRocket/SRWebSocket.h>

#if DEBUG
#import <objc/runtime.h>
#import <React/RCTBridge.h>

#pragma mark - CDPWebSocketClient

@interface CDPWebSocketClient : NSObject <SRWebSocketDelegate>
@property (nonatomic, strong) SRWebSocket *webSocket;
@property (nonatomic, strong) NSMutableArray *messageBuffer;
@property (nonatomic, assign) BOOL isConnected;
@property (nonatomic, strong) NSMutableDictionary *responseBodies; // To store response bodies

+ (instancetype)sharedInstance;
- (void)connect;
- (void)disconnect;
- (void)sendMessage:(NSString *)method params:(NSDictionary *)params;
- (void)storeResponseBody:(NSData *)body forRequestId:(NSString *)requestId;
@end

@implementation CDPWebSocketClient

+ (instancetype)sharedInstance {
    static CDPWebSocketClient *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _messageBuffer = [NSMutableArray new];
        _responseBodies = [NSMutableDictionary new];
        _isConnected = NO;
    }
    return self;
}

- (void)connect {
    if (self.webSocket && self.webSocket.readyState == SR_OPEN) {
        return;
    }
    
    // Custom WebSocket server URL
    NSString *debuggerURLString = @"ws://localhost:2052";
    NSURL *debuggerURL = [NSURL URLWithString:debuggerURLString];
    
    self.webSocket = [[SRWebSocket alloc] initWithURL:debuggerURL];
    self.webSocket.delegate = self;
    [self.webSocket open];
    NSLog(@"[CDPWebSocketClient] Attempting to connect to custom WebSocket: %@", debuggerURLString);
}

- (void)disconnect {
    if (self.webSocket) {
        [self.webSocket close];
        self.webSocket = nil;
        self.isConnected = NO;
        NSLog(@"[CDPWebSocketClient] Disconnected from custom WebSocket.");
    }
}

- (void)sendMessage:(NSString *)method params:(NSDictionary *)params {
    NSDictionary *message = @{
        @"method": method,
        @"params": params
    };
    
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:message options:0 error:&error];
    if (error) {
        NSLog(@"[CDPWebSocketClient] Error creating CDP JSON: %@ for method %@ with params %@", error, method, params);
        return;
    }
    
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    
    if (self.isConnected) {
        [self.webSocket sendString:jsonString error:nil];
        NSLog(@"[CDPWebSocketClient] Sent: %@", jsonString);
    } else {
        [self.messageBuffer addObject:jsonString];
        NSLog(@"[CDPWebSocketClient] Buffered: %@", jsonString);
    }
}

- (void)storeResponseBody:(NSData *)body forRequestId:(NSString *)requestId {
    if (body && requestId) {
        self.responseBodies[requestId] = body;
        NSLog(@"[CDPWebSocketClient] Stored response body for requestId: %@, size: %lu", requestId, (unsigned long)body.length);
    }
}

#pragma mark - SRWebSocketDelegate

- (void)webSocketDidOpen:(SRWebSocket *)webSocket {
    self.isConnected = YES;
    NSLog(@"[CDPWebSocketClient] WebSocket connected.");
    
    // Flush buffered messages
    for (NSString *jsonString in self.messageBuffer) {
        [self.webSocket sendString:jsonString error:nil];
        NSLog(@"[CDPWebSocketClient] Flushed: %@", jsonString);
    }
    [self.messageBuffer removeAllObjects];
    
    // Enable Network domain as it's a CDP-compatible server
    [self sendMessage:@"Network.enable" params:@{}];
}

- (void)webSocket:(SRWebSocket *)webSocket didFailWithError:(NSError *)error {
    self.isConnected = NO;
    NSLog(@"[CDPWebSocketClient] WebSocket failed with error: %@", error);
    // Attempt to reconnect after a delay
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [self connect];
    });
}

- (void)webSocket:(SRWebSocket *)webSocket didCloseWithCode:(NSInteger)code reason:(NSString *)reason wasClean:(BOOL)wasClean {
    self.isConnected = NO;
    NSLog(@"[CDPWebSocketClient] WebSocket closed with code %ld, reason: %@, clean: %d", (long)code, reason, wasClean);
    // Attempt to reconnect after a delay
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{ 
        [self connect];
    });
}

- (void)webSocket:(SRWebSocket *)webSocket didReceiveMessage:(id)message {
    NSLog(@"[CDPWebSocketClient] Received raw message: %@", message); // Log raw incoming message
    
    // Handle incoming messages from debugger (commands from DevTools)
    if ([message isKindOfClass:[NSString class]]) {
        NSError *error;
        NSDictionary *jsonMessage = [NSJSONSerialization JSONObjectWithData:[((NSString *)message) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
        
        if (error) {
            NSLog(@"[CDPWebSocketClient] Error parsing incoming JSON: %@", error);
            return;
        }
        
        NSString *method = jsonMessage[@"method"];
        NSNumber *messageId = jsonMessage[@"id"];
        
        if (messageId) { // This is a command from DevTools, not an event
            NSLog(@"[CDPWebSocketClient] Received CDP command: %@ (id: %@)", method, messageId); // Log command reception

            if ([method isEqualToString:@"Network.getResponseBody"]) {
                NSString *requestId = jsonMessage[@"params"][@"requestId"];
                NSData *bodyData = self.responseBodies[requestId];
                
                NSString *bodyString = nil;
                BOOL base64Encoded = NO;
                if (bodyData) {
                    bodyString = [[NSString alloc] initWithData:bodyData encoding:NSUTF8StringEncoding];
                    if (!bodyString) {
                        bodyString = [bodyData base64EncodedStringWithOptions:0];
                        base64Encoded = YES;
                    }
                }
                
                NSDictionary *result = @{
                    @"body": bodyString ?: @"",
                    @"base64Encoded": @(base64Encoded)
                };
                
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": result
                };
                
                NSError *error;
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:&error];
                if (responseJsonData && !error) {
                    NSString *responseJsonString = [[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding];
                    [self.webSocket sendString:responseJsonString error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Network.getResponseBody response for requestId: %@", requestId);
                } else {
                    NSLog(@"[CDPWebSocketClient] Error creating Network.getResponseBody response JSON: %@", error);
                }
            } else if ([method isEqualToString:@"Runtime.enable"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Runtime.enable response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"Page.enable"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Page.enable response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"Debugger.enable"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{
                        @"debuggerId": @"debugger-id-123"
                    }
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Debugger.enable response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"Profiler.enable"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Profiler.enable response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"Log.enable"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Log.enable response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"DOM.enable"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent DOM.enable response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"CSS.enable"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent CSS.enable response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"Target.setDiscoverTargets"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Target.setDiscoverTargets response for id: %@", messageId);
                }
            } else if ([method isEqualToString:@"Target.setAutoAttach"]) {
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                    NSLog(@"[CDPWebSocketClient] Sent Target.setAutoAttach response for id: %@", messageId);
                }
            } else {
                // Handle other unknown CDP commands by sending a generic success response
                NSLog(@"[CDPWebSocketClient] Received unknown CDP command: %@ (id: %@). Sending generic success response.", method, messageId);
                NSDictionary *response = @{
                    @"id": messageId,
                    @"result": @{}
                };
                NSData *responseJsonData = [NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
                if (responseJsonData) {
                    [self.webSocket sendString:[[NSString alloc] initWithData:responseJsonData encoding:NSUTF8StringEncoding] error:nil];
                }
            }
        } else { // This is an event from DevTools, not a command (e.g., Network.requestWillBeSent from another source)
            NSLog(@"[CDPWebSocketClient] Received CDP event: %@", method);
        }
    }
}

@end

#pragma mark - NetworkLoggingProtocol

@interface NetworkLoggingProtocol : NSURLProtocol <NSURLSessionDataDelegate>
@property (nonatomic, strong) NSURLSessionDataTask *task;
@property (nonatomic, strong) NSString *requestId;
@property (nonatomic, strong) NSMutableData *receivedData;
@end

@implementation NetworkLoggingProtocol

+ (BOOL)canInitWithRequest:(NSURLRequest *)request {
    NSLog(@"[NetworkLogger] Checking request: %@ %@", request.HTTPMethod, request.URL.absoluteString);
    
    if (([request.URL.scheme isEqualToString:@"http"] || [request.URL.scheme isEqualToString:@"https"]) &&
        ![NSURLProtocol propertyForKey:@"NetworkLoggingProtocolHandled" inRequest:request]) {
        NSLog(@"[NetworkLogger] Will handle request: %@", request.URL.absoluteString);
        return YES;
    }
    NSLog(@"[NetworkLogger] Will NOT handle request: %@", request.URL.absoluteString);
    return NO;
}

+ (NSURLRequest *)canonicalRequestForRequest:(NSURLRequest *)request {
    return request;
}

- (void)startLoading {
    self.requestId = [[NSUUID UUID] UUIDString];
    self.receivedData = [NSMutableData data];
    
    NSMutableURLRequest *mutableRequest = [self.request mutableCopy];
    [NSURLProtocol setProperty:@YES forKey:@"NetworkLoggingProtocolHandled" inRequest:mutableRequest];

    NSLog(@"[NetworkLogger] Request: %@ %@", mutableRequest.HTTPMethod, mutableRequest.URL.absoluteString);

    NSString *postData = nil;
    if (mutableRequest.HTTPBody) {
        postData = [[NSString alloc] initWithData:mutableRequest.HTTPBody encoding:NSUTF8StringEncoding];
        if (!postData) {
            postData = [mutableRequest.HTTPBody base64EncodedStringWithOptions:0];
            NSLog(@"[NetworkLogger] Request PostData (Base64): %@", postData);
        } else {
            NSLog(@"[NetworkLogger] Request PostData (UTF8): %@", postData);
        }
    } else if (mutableRequest.HTTPBodyStream) {
        // Read from HTTPBodyStream
        NSInputStream *inputStream = mutableRequest.HTTPBodyStream;
        [inputStream open];
        NSMutableData *bodyData = [NSMutableData data];
        NSInteger maxLength = 4096; // Read in chunks
        uint8_t buffer[maxLength];
        while ([inputStream hasBytesAvailable]) {
            NSInteger bytesRead = [inputStream read:buffer maxLength:maxLength];
            if (bytesRead > 0) {
                [bodyData appendBytes:buffer length:bytesRead];
            } else if (bytesRead < 0) {
                NSLog(@"[NetworkLogger] Error reading HTTPBodyStream: %@", inputStream.streamError);
                break;
            }
        }
        [inputStream close];
        
        if (bodyData.length > 0) {
            postData = [[NSString alloc] initWithData:bodyData encoding:NSUTF8StringEncoding];
            if (!postData) {
                postData = [bodyData base64EncodedStringWithOptions:0];
                NSLog(@"[NetworkLogger] Request PostData (Stream, Base64): %@", postData);
            } else {
                NSLog(@"[NetworkLogger] Request PostData (Stream, UTF8): %@", postData);
            }
        }
    } else {
        NSLog(@"[NetworkLogger] Request HTTPBody is nil or empty.");
    }

    NSLog(@"[NetworkLogger] Final postData to be sent: %@", postData ?: @"(null or empty)");

    [self sendRequestWillBeSentWithPostData:postData];

    NSURLSessionConfiguration *config = [NSURLSessionConfiguration.defaultSessionConfiguration copy];
    NSURLSession *session = [NSURLSession sessionWithConfiguration:config delegate:self delegateQueue:nil];
    self.task = [session dataTaskWithRequest:mutableRequest];
    [self.task resume];
}

- (void)stopLoading {
    [self.task cancel];
    self.task = nil;
}

- (void)sendRequestWillBeSentWithPostData:(NSString *)postData {
    NSTimeInterval timestamp = [[NSDate date] timeIntervalSince1970];
    
    NSMutableDictionary *sanitizedHeaders = [NSMutableDictionary dictionary];
    [self.request.allHTTPHeaderFields enumerateKeysAndObjectsUsingBlock:^(id  _Nonnull key, id  _Nonnull obj, BOOL * _Nonnull stop) {
        if ([key isKindOfClass:[NSString class]] && [obj isKindOfClass:[NSString class]]) {
            sanitizedHeaders[key] = obj;
        } else {
            sanitizedHeaders[[key description]] = [obj description];
        }
    }];

    NSDictionary *requestParams = @{ @"url": self.request.URL.absoluteString, @"method": self.request.HTTPMethod, @"headers": sanitizedHeaders, @"postData": postData ?: @"" };
    NSDictionary *params = @{ @"requestId": self.requestId, @"loaderId": self.requestId, @"documentURL": @"", @"request": requestParams, @"timestamp": @(timestamp), @"initiator": @{@"type": @"script"}, @"type": @"Fetch" };
    [[CDPWebSocketClient sharedInstance] sendMessage:@"Network.requestWillBeSent" params:params];
}

- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)dataTask didReceiveResponse:(NSURLResponse *)response completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler {
    if ([response isKindOfClass:[NSHTTPURLResponse class]]) {
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        NSLog(@"[NetworkLogger] Response Status: %ld for %@", (long)httpResponse.statusCode, httpResponse.URL.absoluteString);

        @try {
            NSMutableDictionary *responseParams = [NSMutableDictionary dictionary];

            responseParams[@"url"] = httpResponse.URL.absoluteString ?: @"";
            responseParams[@"status"] = @(httpResponse.statusCode);
            
            NSString *statusText = [NSHTTPURLResponse localizedStringForStatusCode:httpResponse.statusCode];
            responseParams[@"statusText"] = statusText ?: @"";

            NSMutableDictionary *sanitizedHeaders = [NSMutableDictionary dictionary];
            if (httpResponse.allHeaderFields) {
                [httpResponse.allHeaderFields enumerateKeysAndObjectsUsingBlock:^(id  _Nonnull key, id  _Nonnull obj, BOOL * _Nonnull stop) {
                    sanitizedHeaders[[key description]] = [obj description];
                }];
            }
            responseParams[@"headers"] = sanitizedHeaders;

            responseParams[@"mimeType"] = httpResponse.MIMEType ?: @"application/json";
            responseParams[@"fromDiskCache"] = @(NO);
            responseParams[@"fromServiceWorker"] = @(NO);
            
            NSTimeInterval timestamp = [[NSDate date] timeIntervalSince1970];
            NSDictionary *params = @{
                @"requestId": self.requestId,
                @"loaderId": self.requestId,
                @"timestamp": @(timestamp),
                @"type": @"Fetch",
                @"response": responseParams
            };
            
            [[CDPWebSocketClient sharedInstance] sendMessage:@"Network.responseReceived" params:params];
        } @catch (NSException *exception) {
            NSLog(@"[NetworkLogger] Exception while preparing Network.responseReceived: %@", exception);
        }
    }
    
    [self.client URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)dataTask didReceiveData:(NSData *)data {
    [self.receivedData appendData:data];
    NSTimeInterval timestamp = [[NSDate date] timeIntervalSince1970];
    NSDictionary *params = @{ @"requestId": self.requestId, @"timestamp": @(timestamp), @"dataLength": @(data.length), @"encodedDataLength": @(data.length) };
    [[CDPWebSocketClient sharedInstance] sendMessage:@"Network.dataReceived" params:params];
    [self.client URLProtocol:self didLoadData:data];
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
    NSTimeInterval timestamp = [[NSDate date] timeIntervalSince1970];
    if (error) {
        if (error.code != NSURLErrorCancelled) {
            NSLog(@"[NetworkLogger] Error: %@ for %@", error, task.originalRequest.URL.absoluteString);
            NSDictionary *params = @{ @"requestId": self.requestId, @"timestamp": @(timestamp), @"type": @"Fetch", @"errorText": error.localizedDescription, @"canceled": @(error.code == NSURLErrorCancelled) };
            [[CDPWebSocketClient sharedInstance] sendMessage:@"Network.loadingFailed" params:params];
        }
        [self.client URLProtocol:self didFailWithError:error];
    } else {
        NSLog(@"[NetworkLogger] Finished: %@", task.originalRequest.URL.absoluteString);
        NSDictionary *params = @{ @"requestId": self.requestId, @"timestamp": @(timestamp), @"encodedDataLength": @(self.receivedData.length) };
        [[CDPWebSocketClient sharedInstance] sendMessage:@"Network.loadingFinished" params:params];
        
        // Store the received data for later retrieval by getResponseBody
        [[CDPWebSocketClient sharedInstance] storeResponseBody:[self.receivedData copy] forRequestId:self.requestId];

        // --- NEW CODE TO SEND RESPONSE BODY TO WEBSOCKET --- 
        // 응답값 보내주는 부분.
        if (self.receivedData.length > 0) {
            NSString *bodyString = [[NSString alloc] initWithData:self.receivedData encoding:NSUTF8StringEncoding];
            BOOL base64Encoded = NO;
            if (!bodyString) {
                // If not UTF8, fall back to base64 encoding
                bodyString = [self.receivedData base64EncodedStringWithOptions:0];
                base64Encoded = YES;
            }

            NSDictionary *bodyParams = @{
                @"requestId": self.requestId,
                @"body": bodyString ?: @"",
                @"base64Encoded": @(base64Encoded)
            };
            [[CDPWebSocketClient sharedInstance] sendMessage:@"Network.responseBodyData" params:bodyParams];
            
            if (base64Encoded) {
                NSLog(@"[NetworkLogger] Sent custom Network.responseBodyData for requestId: %@, size: %lu, body (Base64): %@", self.requestId, (unsigned long)self.receivedData.length, bodyString);
            } else {
                NSLog(@"[NetworkLogger] Sent custom Network.responseBodyData for requestId: %@, size: %lu, body (UTF8): %@", self.requestId, (unsigned long)self.receivedData.length, bodyString);
            }
        }
        
        [self.client URLProtocolDidFinishLoading:self];
    }
}

@end

#pragma mark - NSURLSessionConfiguration+Swizzling

@implementation NSURLSessionConfiguration (Logging)

+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // Register the protocol
        [NSURLProtocol registerClass:[NetworkLoggingProtocol class]];
        
        // Swizzle NSURLSessionConfiguration
        Class aClass = [NSURLSessionConfiguration class];
        method_exchangeImplementations(class_getClassMethod(aClass, @selector(defaultSessionConfiguration)), class_getClassMethod(aClass, @selector(swizzled_defaultSessionConfiguration)));
        method_exchangeImplementations(class_getClassMethod(aClass, @selector(ephemeralSessionConfiguration)), class_getClassMethod(aClass, @selector(swizzled_ephemeralSessionConfiguration)));
    });
}

+ (NSURLSessionConfiguration *)swizzled_defaultSessionConfiguration {
    NSURLSessionConfiguration *config = [self swizzled_defaultSessionConfiguration];
    NSMutableArray *protocolClasses = [config.protocolClasses mutableCopy] ?: [NSMutableArray array];
    if (![protocolClasses containsObject:[NetworkLoggingProtocol class]]) {
        [protocolClasses insertObject:[NetworkLoggingProtocol class] atIndex:0];
        config.protocolClasses = protocolClasses;
    }
    return config;
}

+ (NSURLSessionConfiguration *)swizzled_ephemeralSessionConfiguration {
    NSURLSessionConfiguration *config = [self swizzled_ephemeralSessionConfiguration];
    NSMutableArray *protocolClasses = [config.protocolClasses mutableCopy] ?: [NSMutableArray array];
    if (![protocolClasses containsObject:[NetworkLoggingProtocol class]]) {
        [protocolClasses insertObject:[NetworkLoggingProtocol class] atIndex:0];
        config.protocolClasses = protocolClasses;
    }
    return config;
}

@end

#endif // DEBUG

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
#if DEBUG
  // Connect to WebSocket debugger proxy
  [[CDPWebSocketClient sharedInstance] connect];
#endif

  self.moduleName = @"ReactNativeDevtools";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
