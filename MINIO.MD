        # 初始化MinIO服务
        minio_service = MinioService(
            endpoint="192.168.1.102:9000",
            access_key="2NqijPi6Gk5A2cbPwQc3",
            secret_key="THyGX8eWpLIuyTMJvcbfrU6rNYI5NGmhYlFuaVHl",
            secure=False,
            bucket_name="screenshots"
        )