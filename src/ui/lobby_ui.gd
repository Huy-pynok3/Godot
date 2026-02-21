extends Control
class_name LobbyUI

@onready var _connect_button: Button = $ConnectWalletButton
@onready var _status_label: Label = $StatusLabel


func _ready() -> void:
	if OS.has_feature("web"):
		_connect_button.pressed.connect(_on_connect_wallet_pressed)
		Web3Manager.wallet_connected.connect(_on_wallet_connected)
		Web3Manager.wallet_error.connect(_on_wallet_error)
	else:
		_connect_button.disabled = true
		_connect_button.text = "Web3 not available"


func _exit_tree() -> void:
	if OS.has_feature("web"):
		if _connect_button.pressed.is_connected(_on_connect_wallet_pressed):
			_connect_button.pressed.disconnect(_on_connect_wallet_pressed)
		if Web3Manager.wallet_connected.is_connected(_on_wallet_connected):
			Web3Manager.wallet_connected.disconnect(_on_wallet_connected)
		if Web3Manager.wallet_error.is_connected(_on_wallet_error):
			Web3Manager.wallet_error.disconnect(_on_wallet_error)


func _on_connect_wallet_pressed() -> void:
	_connect_button.disabled = true
	_status_label.text = "Connecting..."
	Web3Manager.connect_wallet()


func _on_wallet_connected(address: String) -> void:
	_connect_button.disabled = false
	_status_label.text = "Connected: " + address


func _on_wallet_error(message: String) -> void:
	_connect_button.disabled = false
	_status_label.text = "Error: " + message
	AppLogger.warn("LobbyUI", "Wallet connect error shown to user", {"msg": message})
