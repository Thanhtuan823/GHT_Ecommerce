import * as signalR from '@microsoft/signalr';

class SignalRService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.currentToken = null;
  }

  getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  createConnection() {
    const hubUrl = '/hubs/chat';
    this.currentToken = this.getToken();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => this.getToken(),
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.onclose(() => {
      this.isConnected = false;
    });

    this.connection.onreconnected(() => {
      this.isConnected = true;
    });

    return this.connection;
  }

  async startConnection() {
    const token = this.getToken();
    
    // If token changed (user switched account/logged out), reset connection
    if (this.connection && this.currentToken !== token) {
      await this.stopConnection();
      this.connection = null;
    }

    if (!this.connection) {
      this.createConnection();
    }

    if (this.connection.state === signalR.HubConnectionState.Connected) {
      this.isConnected = true;
      return;
    }

    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      try {
        await this.connection.start();
        this.isConnected = true;
      } catch (err) {
        console.warn('SignalR Connection Error:', err);
        this.isConnected = false;
        throw err;
      }
    }
  }

  async stopConnection() {
    if (this.connection && this.connection.state !== signalR.HubConnectionState.Disconnected) {
      try {
        await this.connection.stop();
      } catch {
        // ignore
      }
      this.isConnected = false;
    }
  }

  async joinConversation(conversationId) {
    await this.startConnection();
    return this.connection.invoke('JoinConversation', Number(conversationId));
  }

  async leaveConversation(conversationId) {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return this.connection.invoke('LeaveConversation', Number(conversationId));
    }
  }

  async sendMessage(conversationId, content, imageUrl = null, replyToId = null) {
    await this.startConnection();
    return this.connection.invoke('SendMessage', Number(conversationId), content || '', imageUrl, replyToId);
  }

  async editMessage(messageId, newContent) {
    await this.startConnection();
    return this.connection.invoke('EditMessage', Number(messageId), newContent);
  }

  async revokeMessage(messageId) {
    await this.startConnection();
    return this.connection.invoke('RevokeMessage', Number(messageId));
  }

  async reactMessage(messageId, emoji) {
    await this.startConnection();
    return this.connection.invoke('ReactMessage', Number(messageId), emoji);
  }

  async staffClaim(conversationId) {
    await this.startConnection();
    return this.connection.invoke('StaffClaim', Number(conversationId));
  }

  async closeConversation(conversationId) {
    await this.startConnection();
    return this.connection.invoke('CloseConversation', Number(conversationId));
  }

  // Event handlers
  onReceiveMessage(callback) {
    this.connection?.on('ReceiveMessage', callback);
  }

  offReceiveMessage(callback) {
    this.connection?.off('ReceiveMessage', callback);
  }

  onMessageEdited(callback) {
    this.connection?.on('MessageEdited', callback);
  }

  offMessageEdited(callback) {
    this.connection?.off('MessageEdited', callback);
  }

  onMessageRevoked(callback) {
    this.connection?.on('MessageRevoked', callback);
  }

  offMessageRevoked(callback) {
    this.connection?.off('MessageRevoked', callback);
  }

  onMessageReactionUpdated(callback) {
    this.connection?.on('MessageReactionUpdated', callback);
  }

  offMessageReactionUpdated(callback) {
    this.connection?.off('MessageReactionUpdated', callback);
  }

  onStaffClaimed(callback) {
    this.connection?.on('StaffClaimed', callback);
  }

  offStaffClaimed(callback) {
    this.connection?.off('StaffClaimed', callback);
  }

  onConversationClosed(callback) {
    this.connection?.on('ConversationClosed', callback);
  }

  offConversationClosed(callback) {
    this.connection?.off('ConversationClosed', callback);
  }

  onConversationUpdated(callback) {
    this.connection?.on('ConversationUpdated', callback);
  }

  offConversationUpdated(callback) {
    this.connection?.off('ConversationUpdated', callback);
  }

  onInternalConversationUpdated(callback) {
    this.connection?.on('InternalConversationUpdated', callback);
  }

  offInternalConversationUpdated(callback) {
    this.connection?.off('InternalConversationUpdated', callback);
  }

  onReceiveNotification(callback) {
    this.connection?.on('ReceiveNotification', callback);
  }

  offReceiveNotification(callback) {
    this.connection?.off('ReceiveNotification', callback);
  }
}

const signalRService = new SignalRService();
export default signalRService;
