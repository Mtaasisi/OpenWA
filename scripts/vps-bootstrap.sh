#!/usr/bin/env bash
# One-time VPS hardening: swap file + Docker install check.
# Run as root on Ubuntu 24.04 Hostinger VPS.

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

echo "==> Checking Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi
docker compose version || docker-compose version

echo "==> Swap (2G) if missing"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap enabled"
else
  echo "Swap already configured"
fi

echo "==> UFW hint (open dashboard port)"
echo "  ufw allow 22/tcp"
echo "  ufw allow 2886/tcp"
echo "  ufw enable"

echo "Bootstrap complete."
