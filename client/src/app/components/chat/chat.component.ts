import { Component, OnInit } from '@angular/core';
import { User } from 'src/app/models/user';
import { ActivatedRoute } from '@angular/router';
import { UserService } from 'src/app/services/user.service';
import { ChatService } from 'src/app/services/chat.service';
import { Chat } from 'src/app/models/chat';
import io from 'socket.io-client'
import Toast from 'src/app/lib/toast';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
  chats: [Chat]
  contacts: any
  messages: [{}]
  socket: any

  loggedInUser: User
  currentUser: User

  token: string

  messageInput:string

  constructor(private activeRoute: ActivatedRoute, private userService: UserService, private chatService: ChatService) { }

  ngOnInit() {
    const loggedInUser = this.getLoggedInUser()
    this.token = localStorage.getItem('id_token') 

    this.activeRoute.params.subscribe(async ({username}) => {

      await this.getCurrentUserData(username)
      await this.getChats(loggedInUser.username, this.token)
      this.handleSockets()
      this.getMessages()

    })
  }

  handleSockets() {
    this.socket = io.connect('http://192.168.0.2:3000/chat')
    this.socket.on('connect', () => {
      this.socket.emit('user-connected', this.loggedInUser.username)
      this.socket.on('message', this.messageReceived.bind(this))
    })
  }

  messageReceived(msg:string, from:string) {
    if (!this.contacts.includes(from)) this.contacts.push(from)
    if(from != this.currentUser.username) Toast.fire({
      title: 'New Message',
      type: 'info',
      html: `You've received a new message from <a href="/chat/${from}">${from}<a>`
    })
    
    else
    this.messages.push({msg, from})
    
  }

  getMessages() {
    this.chatService.getMessages(this.currentUser.username, this.token).subscribe((messages: [string]) => {
      this.messages = messages
    })
  }

  getLoggedInUser() {
    this.loggedInUser = JSON.parse(localStorage.getItem('user'))
    return this.loggedInUser
  }

  getCurrentUserData(username:string) {
    return new Promise(res => {
      this.userService.getProfile(username).subscribe(({user}) => {
        this.currentUser = user
        res()
      })
    })
  }

  getChats(username:string, token:string) {
    return new Promise(res => {
      this.chatService.getChats(username, token).subscribe((chats:[Chat]) => {
        this.chats = chats
        this.contacts = chats.map((chat:Chat) => chat.members.filter(member => member != username)[0])
        res()
      })
    })
  }

  memberUsername(chat:Chat) {
    return chat.members.find((username:string) => username != this.loggedInUser.username)
  }

  onKeyPressed(e) {
    if(e.keyCode == 13) {
      this.submitMessage()
    }
  }

  submitMessage() {
    this.sendMessage(this.messageInput, this.currentUser.username, this.token)
    this.messageInput = ''
  }

  writing() {
    console.log('writing...')
  }

  sendMessage(msg:string, receiver:string, token:string) {
    this.chatService.sendMessage(msg, receiver, token).subscribe((message) => {
      this.messages.push(message)
      this.socket.emit('reply', msg, receiver, token)
    })
  }
}
